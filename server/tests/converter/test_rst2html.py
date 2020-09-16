def test_rst2html():
    from indie_tracker.converter.rst2html import rst2html

    expected = """<div class="document">
<ul class="simple">
<li><p>foo</p></li>
</ul>
</div>
"""
    assert rst2html("* foo") == expected


def test_rst2html_directive_foo():
    from indie_tracker.converter.rst2html import rst2html

    rst = """
.. mermaid::

  bar
  baz
"""
    assert '<div class="mermaid">bar\nbaz</div>' in rst2html(rst)
