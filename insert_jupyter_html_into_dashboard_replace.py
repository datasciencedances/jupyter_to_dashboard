import base64
import argparse
from pathlib import Path
import json
import html

TEMPLATE = """<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="{logo}" type="image/x-icon">
    <title>F88 - {title}</title>
    <style>
{gridstack_css}
    </style>
    <style>
{dashboardtify_css}
    </style>
    <script>
{gridstack_js}
    </script>
    <script>
{iconify_js}
    </script>
    <script>
{dashboardtify_js}
    </script>

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

    # Đọc các file CSS và JS từ thư mục hiện tại
    script_dir = Path(__file__).parent
    
    # Đọc CSS files
    gridstack_css_path = script_dir / "gridstack.min.css"
    dashboardtify_css_path = script_dir / "dashboardtify.css"
    
    if not gridstack_css_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file: {gridstack_css_path}")
    if not dashboardtify_css_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file: {dashboardtify_css_path}")
    
    gridstack_css = gridstack_css_path.read_text(encoding="utf-8")
    dashboardtify_css = dashboardtify_css_path.read_text(encoding="utf-8")
    
    # Đọc JS files
    gridstack_js_path = script_dir / "gridstack-all.js"
    iconify_js_path = script_dir / "iconify.min.js"
    dashboardtify_js_path = script_dir / "dashboardtify.js"
    
    if not gridstack_js_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file: {gridstack_js_path}")
    if not iconify_js_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file: {iconify_js_path}")
    if not dashboardtify_js_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file: {dashboardtify_js_path}")
    
    gridstack_js = gridstack_js_path.read_text(encoding="utf-8")
    iconify_js = iconify_js_path.read_text(encoding="utf-8")
    dashboardtify_js = dashboardtify_js_path.read_text(encoding="utf-8")
    
    # Escape các ký tự đặc biệt trong JavaScript để nhúng vào HTML
    # Đặc biệt cần escape </script> để tránh kết thúc thẻ script sớm
    gridstack_js = gridstack_js.replace("</script>", "<\\/script>")
    iconify_js = iconify_js.replace("</script>", "<\\/script>")
    dashboardtify_js = dashboardtify_js.replace("</script>", "<\\/script>")

    # Tên file (không phần mở rộng) dùng cho fileName và title mặc định
    output_path = Path(config["output"]).expanduser().resolve()
    html_content = TEMPLATE.format(
        logo=config["logo"],
        title=config["title"],
        file_name=config["title"],
        notebook_base64=notebook_b64,
        saved_data=config["saved_data"],
        gridstack_css=gridstack_css,
        dashboardtify_css=dashboardtify_css,
        gridstack_js=gridstack_js,
        iconify_js=iconify_js,
        dashboardtify_js=dashboardtify_js,
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