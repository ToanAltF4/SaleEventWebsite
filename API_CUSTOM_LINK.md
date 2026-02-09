# API: Custom Link

## `POST /api/custom-link`

Tạo affiliate short link thông qua Shopee Affiliate GraphQL API.

**Auth:** Yêu cầu đăng nhập (session)

---

## Request

**Content-Type:** `application/json`

```json
{
  "cookie": "string (bắt buộc) - Cookie từ affiliate.shopee.vn",
  "original_link": "string (bắt buộc) - Link sản phẩm Shopee gốc"
}
```

**Ví dụ:**

```json
{
  "cookie": "_gcl_au=1.1.96726475...; SPC_EC=...",
  "original_link": "https://shopee.vn/product/420476723/22176845496"
}
```

---

## Response

### Thành công (200)

```json
{
  "data": {
    "batchCustomLink": [
      {
        "shortLink": "https://s.shopee.vn/70EXXO9ynF",
        "longLink": "https://shopee.vn/universal-link/product/420476723/22176845496?gads_t_sig=...&utm_campaign=-&utm_content=----&utm_medium=affiliates&utm_source=an_17318680390",
        "failCode": 0
      }
    ]
  }
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `shortLink` | string | Link affiliate rút gọn |
| `longLink` | string | Link affiliate đầy đủ |
| `failCode` | int | `0` = thành công, khác `0` = lỗi |

---

### Lỗi validation (400)

```json
{ "error": "Cookie không được để trống" }
```

```json
{ "error": "Link gốc không được để trống" }
```

---

### Lỗi từ Shopee - Cookie hết hạn/không hợp lệ (200)

```json
{
  "action_type": 2,
  "error": 90309999,
  "is_customized": false,
  "is_login": true,
  "tracking_id": "741c80b0f54-8af8-4ce8-ad9e-ba7741372fed"
}
```

---

### Lỗi từ Shopee - Link không hợp lệ (200)

```json
{
  "data": {
    "batchCustomLink": [
      {
        "shortLink": "",
        "longLink": "",
        "failCode": 1
      }
    ]
  }
}
```

---

### Lỗi kết nối (500)

```json
{ "error": "Lỗi kết nối Shopee: <chi tiết lỗi>" }
```

---

## Ghi chú

- Cookie lấy từ trình duyệt sau khi đăng nhập tại `https://affiliate.shopee.vn`
- Cookie có thời hạn, cần cập nhật khi hết hạn
- Sử dụng `curl_cffi` với `impersonate="chrome"` để bypass TLS fingerprinting
- Trang test: `/test` (yêu cầu đăng nhập)
