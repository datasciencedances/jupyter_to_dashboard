import base64
import argparse
from pathlib import Path
import json
TEMPLATE = """<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="{logo}" type="image/x-icon">
    <title>F88 - {title}</title>
    <link href="https://www.dashboardtify.com/gridstack/gridstack.min.css" rel="stylesheet">
    <script src="https://www.dashboardtify.com/gridstack/gridstack-all.js"></script>
    <script src="https://code.iconify.design/1/1.0.6/iconify.min.js"></script>
    <link href="https://www.dashboardtify.com/1.6/dashboardtify.css" rel="stylesheet">
    <script src="https://www.dashboardtify.com/1.6/dashboardtify.js" defer></script>

  </head>
  <body>
    <div id="loader-container" class="loader-container">
      <div id="loader" class="loader"></div>
    </div>

    <script>
      // Các biến config gốc
      var fileName = '{file_name}';
      var savedData = {saved_data};
      var edit = false;
    </script>

    <script>
      // Base64 của notebook HTML được nhúng trực tiếp
      var notebookBase64 = "{notebook_base64}";

      // Biến urlNotebook dùng data URL thay vì phải upload lên mạng
      var urlNotebook = "data:text/html;base64," + notebookBase64;
    </script>
  </body>
</html>
"""


def build_html(config: dict):
    notebook_path = Path(config["input"]).expanduser().resolve()
    if not notebook_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file notebook: {notebook_path}")

    # Đọc file notebook dạng bytes rồi encode Base64
    notebook_bytes = notebook_path.read_bytes()
    notebook_b64 = base64.b64encode(notebook_bytes).decode("utf-8")

    # Tên file (không phần mở rộng) dùng cho fileName và title mặc định
    output_path = Path(config["output"]).expanduser().resolve()
    html_content = TEMPLATE.format(
        logo=config["logo"],
        title=config["title"],
        file_name=config["title"],
        notebook_base64=notebook_b64,
        saved_data=config["saved_data"],
    )

    # Ghi ra file HTML output
    output_path.write_text(html_content, encoding="utf-8")
    print(f"Đã tạo file HTML tự chứa tại: {output_path}")


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--config", type=str, required=True)
    args = args.parse_args()
    path_config = Path(args.config).expanduser().resolve()
    with open(path_config, "r") as f:
        config = json.load(f)
    build_html(config)
  
if __name__ == "__main__":
    main()