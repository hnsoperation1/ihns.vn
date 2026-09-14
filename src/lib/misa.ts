// Client gọi API MISA AMIS Chấm Công — xem tài liệu gốc
// D:\hns-erp\TichHopAPIChamCong.md (mục B.I-VII lấy dữ liệu, C.I đẩy dữ
// liệu). MISA chỉ là 1 nguồn đầu vào/đầu ra phụ cho hrm_attendance_logs,
// không phải hệ thống chính — iHNS vẫn là canonical.

import { createHmac, randomUUID } from 'crypto'

const MISA_BASE_URL = 'https://amisapp.misa.vn/APIS/TimesheetOpenAPI/api/Open'

export type MisaRawPunch = {
  EmployeeCode: string
  FullName: string
  OrganizationUnitName: string
  CheckTime: string
  JobPositionName: string
  DataSourceID: number
}

function createMisaToken(secretKey: string, transactionId: string) {
  return createHmac('sha256', secretKey).update(transactionId, 'utf8').digest('base64')
}

// MISA yêu cầu định dạng "yyyy-MM-dd HH:mm:ss", không phải ISO — dùng cho
// get-data-timekeeper (khoảng thời gian có giờ phút).
function formatMisaDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Các API lấy danh sách theo khoảng ngày (get-data-timesheet(-summary),
// get-data-application) chỉ nhận "yyyy-MM-dd", không có giờ.
function formatMisaDateOnly(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// insert-timekeeper-data yêu cầu đúng "...T08:00:00+07:00" — quy đổi tay
// sang giờ Việt Nam (luôn UTC+7, không có giờ mùa hè) thay vì dùng
// Date.toISOString() mặc định (ra hậu tố "Z"/UTC), vì đây là chỗ ghi dữ
// liệu chấm công THẬT lên MISA nên cần đúng giờ tuyệt đối, không phụ
// thuộc timezone của server chạy code.
function formatMisaOffsetDateTime(d: Date) {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}T${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}:${pad(vn.getUTCSeconds())}+07:00`
}

type MisaEnvelope<T> = {
  Success: boolean
  UserMessage: string | null
  SystemMessage: string | null
  Data: T
}

// Gọi 1 API MISA bất kỳ dưới /Open — dùng chung cho mọi endpoint, tự tạo
// header xác thực (x-clientid/x-transactionid/x-token) theo đúng thuật
// toán tài liệu mục A.II-III.
async function callMisaApi<T>(path: string, opts: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const clientId = process.env.MISA_CLIENT_ID
  const secretKey = process.env.MISA_SECRET_KEY
  if (!clientId || !secretKey) throw new Error('Thiếu MISA_CLIENT_ID hoặc MISA_SECRET_KEY')

  const transactionId = randomUUID()
  const res = await fetch(`${MISA_BASE_URL}/${path}`, {
    method: opts.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-clientid': clientId,
      'x-transactionid': transactionId,
      'x-token': createMisaToken(secretKey, transactionId),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (!res.ok) throw new Error(`MISA API lỗi HTTP ${res.status} (${path})`)
  const json = (await res.json()) as MisaEnvelope<T>
  if (!json.Success) throw new Error(json.UserMessage ?? json.SystemMessage ?? `MISA API (${path}) trả về lỗi không rõ`)
  return json.Data
}

// Phân trang chung cho các API "get-data-*" dạng {PageSize, PageIndex,
// Filter, CustomFilter, QuickSearch, CustomParam} — get-data-timekeeper
// KHÔNG theo dạng này (body phẳng, không có CustomParam) nên không dùng
// hàm này, xem fetchMisaRawPunches bên dưới.
async function fetchMisaPaged<T>(path: string, customParam: Record<string, unknown>, pageSize = 100): Promise<T[]> {
  const all: T[] = []
  let pageIndex = 1
  while (true) {
    const data = await callMisaApi<{ Total: number; PageData: T[] }>(path, {
      body: { PageSize: pageSize, PageIndex: pageIndex, Filter: null, CustomFilter: null, QuickSearch: {}, CustomParam: customParam },
    })
    const page = data?.PageData ?? []
    all.push(...page)
    const total = data?.Total ?? all.length
    if (page.length === 0 || all.length >= total) break
    pageIndex++
  }
  return all
}

// Lấy TOÀN BỘ lượt quẹt thô trong khoảng thời gian, tự phân trang cho tới
// khi đủ Total — cron chạy 1 lần/ngày nên không cần tối ưu quá, ưu tiên đơn
// giản/chắc chắn lấy đủ dữ liệu.
export async function fetchMisaRawPunches(fromDate: Date, toDate: Date): Promise<MisaRawPunch[]> {
  const pageSize = 100
  const all: MisaRawPunch[] = []
  let pageIndex = 1

  while (true) {
    const data = await callMisaApi<{ Total: number; PageData: MisaRawPunch[] }>('get-data-timekeeper', {
      body: {
        PageSize: pageSize,
        PageIndex: pageIndex,
        FromDate: formatMisaDate(fromDate),
        ToDate: formatMisaDate(toDate),
      },
    })

    const page = data?.PageData ?? []
    all.push(...page)

    const total = data?.Total ?? all.length
    if (page.length === 0 || all.length >= total) break
    pageIndex++
  }

  return all
}

// B.VI — danh sách nhân viên bên MISA (GET, không có body) — dùng để cho
// admin CHỌN đúng nhân viên khi khớp mã, thay vì gõ tay dễ sai.
export type MisaEmployee = {
  EmployeeCode: string
  FullName: string
  OrganizationUnitID: number
  OrganizationUnitName: string
  JobPositionID: number | string
  JobPositionName: string
  ShiftCode: string
  EmployeeStatusID: number
}

export async function fetchMisaEmployees(): Promise<MisaEmployee[]> {
  const data = await callMisaApi<MisaEmployee[]>('get-data-employee', { method: 'GET' })
  return data ?? []
}

// B.V — danh sách "đơn" bên MISA, 6 loại theo SubSystemCode. Shape trả về
// khác nhau khá nhiều giữa các loại (xem tài liệu mục B.V.ii) nên để loose
// type — UI lớp trên (misaApplicationTypes.ts) tự biết field nào ứng với
// loại nào.
export type MisaApplicationSubSystem =
  | 'Attendance' // Đơn xin nghỉ
  | 'LateInEarlyOut' // Đơn đi muộn về sớm
  | 'OverTime' // Đơn đăng ký làm thêm
  | 'MissionAllowance' // Đơn công tác
  | 'UpdateTimekeeper' // Đơn cập nhật công
  | 'ChangeShift' // Đơn đổi ca

export type MisaApplicationRow = Record<string, unknown> & {
  FullName: string
  EmployeeCode: string
  Status: number
}

export async function fetchMisaApplications(
  subSystemCode: MisaApplicationSubSystem,
  fromDate: Date,
  toDate: Date
): Promise<MisaApplicationRow[]> {
  return fetchMisaPaged<MisaApplicationRow>('get-data-application', {
    SubSystemCode: subSystemCode,
    FromDate: formatMisaDateOnly(fromDate),
    ToDate: formatMisaDateOnly(toDate),
  })
}

// B.I/II — bảng chấm công CHI TIẾT theo ca/ngày/giờ (khác bảng TỔNG HỢP ở
// dưới) — mỗi bảng ứng với 1 đơn vị/kỳ, DataDaily là 1 chuỗi JSON chứa
// Day1..Day31, mỗi ngày 1 mảng chi tiết (giờ vào/ra thực tế, trạng thái,
// nghỉ, OT...). Dùng cho màn tra cứu thô "xem MISA đang có gì" — không
// tích hợp/tính toán gì thêm, chỉ hiển thị lại nguyên văn.
export type MisaTimesheet = {
  TimeSheetID: number
  TimeSheetName: string
  OrganizationUnitName: string
  JobPositionNames: string
  FromDate: string
  ToDate: string
  TimeSheetType: number
}

export async function fetchMisaTimesheet(fromDate: Date, toDate: Date): Promise<MisaTimesheet[]> {
  return fetchMisaPaged<MisaTimesheet>('get-data-timesheet', {
    FromDate: formatMisaDateOnly(fromDate),
    ToDate: formatMisaDateOnly(toDate),
  })
}

export type MisaTimesheetDetailRow = {
  TimeSheetID: number
  FullName: string
  EmployeeCode: string
  OrganizationUnitName: string
  JobPositionName: string
  DataDaily: string // chuỗi JSON — Record<"Day1".."Day31", object[]>
}

export async function fetchMisaTimesheetDetail(timeSheetId: number): Promise<MisaTimesheetDetailRow[]> {
  return fetchMisaPaged<MisaTimesheetDetailRow>('get-data-timesheet-detail', {
    TimeSheetID: timeSheetId,
  })
}

// B.III/IV — bảng chấm công TỔNG HỢP (công chuẩn, tổng công, đi muộn về
// sớm, nghỉ, OT theo từng nhân viên/kỳ) — dùng để đối chiếu với số iHNS tự
// tính.
export type MisaTimesheetSummary = {
  TimeSheetsSummaryID: number
  TimeSheetSummaryName: string
  TimeSheetSummaryType: number
  OrganizationUnitName: string
  JobPositionName: string
  StartDate: string
  EndDate: string
  IsWorkLocation: number
}

export async function fetchMisaTimesheetSummary(fromDate: Date, toDate: Date): Promise<MisaTimesheetSummary[]> {
  return fetchMisaPaged<MisaTimesheetSummary>('get-data-timesheet-summary', {
    FromDate: formatMisaDateOnly(fromDate),
    ToDate: formatMisaDateOnly(toDate),
  })
}

export type MisaTimesheetSummaryDetail = {
  TimeSheetSummaryID: number
  FullName: string
  EmployeeCode: string
  OrganizationUnitName: string
  JobPositionName: string
  Standard: number
  WorkingWeekDay: number
  WorkingWeekEnd: number
  WorkingHoliday: number
  TotalWorking: number
  TotalWorkingActual: number
  TotalOverTime: number
  TotalLeave: number
  TotalLateOutEarly: number
  TotalMinuteLateOutEarly: number
}

export async function fetchMisaTimesheetSummaryDetail(timeSheetSummaryId: number): Promise<MisaTimesheetSummaryDetail[]> {
  return fetchMisaPaged<MisaTimesheetSummaryDetail>('get-data-timesheet-summary-detail', {
    TimeSheetSummaryID: timeSheetSummaryId,
  })
}

// C.I — đẩy 1 lượt chấm công của iHNS LÊN MISA (chiều ngược với
// fetchMisaRawPunches). MISA gắn DataSourceID=11 ("Chấm công từ ứng dụng
// CRM") cho dữ liệu tới từ endpoint này — xem misaSync.ts, cron pull PHẢI
// lọc bỏ DataSourceID=11 để không tự kéo ngược lại dữ liệu vừa đẩy lên,
// tạo dòng trùng trong hrm_attendance_logs.
export async function pushMisaCheckIn(
  employeeCode: string,
  checkTime: Date,
  opts?: { lat?: number | null; lng?: number | null }
): Promise<void> {
  await callMisaApi<null>('insert-timekeeper-data', {
    body: [
      {
        CheckTime: formatMisaOffsetDateTime(checkTime),
        EmployeeCode: employeeCode,
        Longitude: opts?.lng ?? 0,
        Latitude: opts?.lat ?? 0,
        WifiName: null,
        GPSName: null,
        QRCodeName: null,
      },
    ],
  })
}
