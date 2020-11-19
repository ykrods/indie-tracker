from .mermaid import setup
from .converter import Converter

def rst2html(rst):
    c = Converter([setup])
    c.convert(rst)

    return c.result['html_body']
