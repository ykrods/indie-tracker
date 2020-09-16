from . import mermaid  # NOQA

from docutils.core import publish_parts
from docutils.writers.html5_polyglot import Writer


def rst2html(rst):
    """

    * `doctitle_xform = True` の場合, html_title が返せるが、
      initial_header_level の指定が効かない
    """
    writer = Writer()

    result = publish_parts(
        source=rst,
        writer=writer,
        settings_overrides={
            'initial_header_level': 2,
            'doctitle_xform': False,
            'file_insertion_enabled': False,
            'raw_enabled': False,
            'syntax_highlight': 'short',
        },
    )
    return result['html_body']
