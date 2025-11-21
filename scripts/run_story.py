import papermill as pm
import nbformat
from nbconvert import HTMLExporter
from pathlib import Path
import sys


def main(notebook, input_path, html_output):
    notebook = Path(notebook)
    executed_nb = notebook.with_name(notebook.stem + "_executed.ipynb")

    # 1. Chạy notebook với input_path
    pm.execute_notebook(
        input_path=str(notebook),
        output_path=str(executed_nb),
        parameters={"input_path": input_path},
    )

    # 2. Convert sang HTML
    nb = nbformat.read(executed_nb, as_version=4)
    html_exporter = HTMLExporter()
    body, _ = html_exporter.from_notebook_node(nb)
    Path(html_output).write_text(body, encoding="utf-8")
    print(f"Done! HTML saved to {html_output}")


if __name__ == "__main__":
    # Ví dụ dùng: python run_story.py storytelling.ipynb data.csv output.html
    if len(sys.argv) != 4:
        print("Usage: python run_story.py <notebook.ipynb> <input_path.csv> <output.html>")
        sys.exit(1)

    main(sys.argv[1], sys.argv[2], sys.argv[3])
