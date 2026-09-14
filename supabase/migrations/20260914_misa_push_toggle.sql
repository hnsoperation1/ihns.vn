-- Công tắc bật/tắt tính năng đẩy chấm công iHNS lên MISA AMIS (tính năng 4,
-- xem TichHopAPIChamCong.md mục C.I insert-timekeeper-data) — mặc định TẮT
-- để deploy xong không tự động đẩy dữ liệu thật lên MISA ngoài ý muốn, chỉ
-- bật khi admin chủ động bấm (UI: hns-crm /cham-cong/quan-tri).
ALTER TABLE hrm_app_settings ADD COLUMN IF NOT EXISTS misa_push_enabled boolean NOT NULL DEFAULT false;
