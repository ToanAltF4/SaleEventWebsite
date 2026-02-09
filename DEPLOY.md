# Hướng dẫn Deploy "Săn Sale Cùng Kim Ngân"

## Mục lục
- [Cách 1: Cloudflare Tunnel (dùng PC cá nhân)](#cách-1-cloudflare-tunnel-dùng-pc-cá-nhân)
- [Cách 2: VPS (chạy 24/7 trên server)](#cách-2-vps-chạy-247-trên-server)

---

## Cách 1: Cloudflare Tunnel (dùng PC cá nhân)

Dùng máy tính cá nhân làm server, tunnel qua Cloudflare để trỏ domain `kimngan.site`.

### Bước 1: Trỏ domain về Cloudflare

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Bấm **Add a site** → nhập `kimngan.site` → chọn plan **Free**
3. Cloudflare sẽ cho 2 nameservers, ví dụ:
   ```
   alice.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
4. Vào **Tenten.vn** → Quản lý domain `kimngan.site` → **Đổi Nameserver** thành 2 nameservers của Cloudflare
5. Đợi 5-30 phút để nameserver cập nhật

### Bước 2: Cài Cloudflared

```bash
# Windows (dùng winget)
winget install cloudflare.cloudflared

# Hoặc tải trực tiếp:
# https://github.com/cloudflare/cloudflared/releases/latest
# Tải file cloudflared-windows-amd64.exe
```

### Bước 3: Đăng nhập Cloudflared

```bash
cloudflared tunnel login
```
Trình duyệt sẽ mở → chọn domain `kimngan.site` → Authorize.

### Bước 4: Tạo Tunnel

```bash
# Tạo tunnel tên "kimngan"
cloudflared tunnel create kimngan

# Ghi nhớ Tunnel ID (dạng: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
```

### Bước 5: Cấu hình Tunnel

Tạo file `C:\Users\ADMIN\.cloudflared\config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\ADMIN\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: kimngan.site
    service: http://localhost:5000
  - hostname: www.kimngan.site
    service: http://localhost:5000
  - service: http_status:404
```

### Bước 6: Tạo DNS record

```bash
cloudflared tunnel route dns kimngan kimngan.site
cloudflared tunnel route dns kimngan www.kimngan.site
```

### Bước 7: Chạy

Mở 2 terminal:

```bash
# Terminal 1: Chạy Flask
cd D:\web-ngan\SaleEventWebsite
python app.py

# Terminal 2: Chạy Tunnel
cloudflared tunnel run kimngan
```

Truy cập `https://kimngan.site` — xong!

### Lưu ý Tunnel
- PC phải BẬT và chạy cả 2 terminal thì web mới hoạt động
- Tắt PC = web offline
- Muốn chạy 24/7 → dùng VPS (Cách 2)

---

## Cách 2: VPS (chạy 24/7 trên server)

### Chọn VPS

| Nhà cung cấp | Gói rẻ nhất | Giá/tháng |
|---|---|---|
| **Vultr** | 1 vCPU, 1GB RAM | ~$6 (~150k) |
| **DigitalOcean** | 1 vCPU, 1GB RAM | $6 (~150k) |
| **Aeza** | 1 vCPU, 1GB RAM | ~$3 (~75k) |
| **Contabo** | 4 vCPU, 8GB RAM | ~$7 (~175k) |

Chọn **Ubuntu 22.04** khi tạo VPS.

### Bước 1: Trỏ domain (không cần Cloudflare)

Vào **Tenten.vn** → DNS → thêm 2 record:

```
Type: A    | Name: @   | Value: <IP_VPS>
Type: A    | Name: www | Value: <IP_VPS>
```

### Bước 2: SSH vào VPS

```bash
ssh root@<IP_VPS>
```

### Bước 3: Cài đặt môi trường

```bash
# Cập nhật hệ thống
apt update && apt upgrade -y

# Cài Python, pip, nginx, certbot
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git
```

### Bước 4: Upload code lên VPS

```bash
# Cách A: Clone từ GitHub
cd /var/www
git clone https://github.com/<your-repo>/SaleEventWebsite.git
cd SaleEventWebsite

# Cách B: Copy từ máy local (chạy trên máy local)
scp -r D:\web-ngan\SaleEventWebsite root@<IP_VPS>:/var/www/SaleEventWebsite
```

### Bước 5: Cài dependencies

```bash
cd /var/www/SaleEventWebsite

# Tạo virtual environment
python3 -m venv venv
source venv/bin/activate

# Cài packages
pip install -r requirements.txt
pip install gunicorn
```

### Bước 6: Tạo file .env

```bash
nano /var/www/SaleEventWebsite/.env
```

Nội dung:
```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
SECRET_KEY=kimngan-sale-secret-2026
```

### Bước 7: Tạo Gunicorn service

```bash
nano /etc/systemd/system/kimngan.service
```

Nội dung:
```ini
[Unit]
Description=Săn Sale Cùng Kim Ngân
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/SaleEventWebsite
ExecStart=/var/www/SaleEventWebsite/venv/bin/gunicorn -w 2 -b 127.0.0.1:5000 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Khởi động service
systemctl daemon-reload
systemctl enable kimngan
systemctl start kimngan

# Kiểm tra
systemctl status kimngan
```

### Bước 8: Cấu hình Nginx

```bash
nano /etc/nginx/sites-available/kimngan
```

Nội dung:
```nginx
server {
    listen 80;
    server_name kimngan.site www.kimngan.site;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /var/www/SaleEventWebsite/static/;
        expires 7d;
    }
}
```

```bash
# Kích hoạt site
ln -s /etc/nginx/sites-available/kimngan /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### Bước 9: Cài SSL (HTTPS miễn phí)

```bash
certbot --nginx -d kimngan.site -d www.kimngan.site
```

Nhập email, đồng ý điều khoản → Certbot tự cấu hình HTTPS + auto-renew.

### Bước 10: Kiểm tra

Truy cập `https://kimngan.site` — xong!

---

## Các lệnh quản lý VPS thường dùng

```bash
# Xem log
journalctl -u kimngan -f

# Restart app sau khi update code
systemctl restart kimngan

# Update code từ GitHub
cd /var/www/SaleEventWebsite
git pull
systemctl restart kimngan

# Renew SSL (tự động, nhưng nếu cần thủ công)
certbot renew
```

---

## Tóm tắt

| | Tunnel (PC cá nhân) | VPS |
|---|---|---|
| **Chi phí** | Miễn phí | ~75k-175k/tháng |
| **Uptime** | PC bật = web online | 24/7 |
| **Tốc độ** | Phụ thuộc mạng nhà | Ổn định |
| **SSL** | Cloudflare tự cấp | Certbot miễn phí |
| **Phù hợp** | Test, dùng tạm | Production |
