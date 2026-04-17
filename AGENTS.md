# Chỉ dẫn cho AI (Project Context)

Bạn là chuyên gia hỗ trợ dự án "Công cụ dạy-học Toán" (Tool-teach-for-math). Hãy tuân thủ các quy tắc sau:

## 1. Mục tiêu dự án
- Xây dựng nền tảng học toán tương tác với khả năng trực quan hóa mã TikZ/LaTeX.
- Hỗ trợ giáo viên upload đề bài từ tệp .tex và tự động phân loại.

## 2. Các tính năng cốt lõi
- **Trực quan hóa**: Sử dụng mã TikZ và bản xem trước SVG.
- **Hỗ trợ giọng nói**: Tích hợp TTS (Gemini API) để đọc đề bài.
- **Dạng bài tập**: Hỗ trợ 4 dạng (Trắc nghiệm 1 lựa chọn, Trắc nghiệm Đúng/Sai, Trả lời ngắn, Tự luận).
- **AI Backend**: Sử dụng Gemini 3.1 Pro để phân tích tệp .tex.

## 3. Quy cách kỹ thuật
- **Ngôn ngữ**: TypeScript + React (Vite).
- **Styling**: Tailwind CSS với phong cách "Editorial/Technical Dashboard".
- **Toán học**: Sử dụng KaTeX (`react-katex`) để hiển thị công thức.
- **Biến môi trường**: Cần `GEMINI_API_KEY` cho các tính năng AI.

## 4. Lưu ý quan trọng
- Luôn giữ mã TikZ sạch sẽ, sử dụng thư viện `tkz-tab` cho bảng biến thiên.
- Phản hồi bằng tiếng Việt khi trao đổi với người dùng.
- Khi upload file .tex, đảm bảo AI phân loại đúng `questionType`.
