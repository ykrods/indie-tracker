from docutils import nodes
from docutils.core import (
    publish_doctree,
    publish_parts,
)
from docutils.io import DocTreeInput
from docutils.writers.html5_polyglot import Writer

class Converter():
    def __init__(self, extensions=[]):
        self.extensions = extensions

    def setup(self, source, source_name):
        # Quite Simple implemention for extension
        for setup in self.extensions:
            setup()

        self.source = source
        self.source_name = source_name
        self.metadata = {}
        self.doctree = None

        self.settings_overrides = {
            'output_encoding': 'unicode',
            # 'doctitle_xform': True,
            'file_insertion_enabled': False,
            'raw_enabled': False,
            'syntax_highlight': 'short',
        }

    def convert(self, rst, srcname=''):
        self.setup(rst, srcname)
        self._parse_metadata()

        return self.write()

    def parse(self, rst, srcname):
        self.setup(rst, srcname)
        self._parse_metadata()

    def _parse_metadata(self):
        doctree = publish_doctree(self.source, self.source_name)

        if 0 == len(doctree) or not isinstance(doctree[0], nodes.docinfo):
            self.doctree = doctree
            return

        defined_node_types = ['author', 'status']

        for node in doctree[0]:
            for node_type in defined_node_types:
                if isinstance(node, getattr(nodes, node_type)):
                    self.metadata[node_type] = node.astext()
                    break;

            if isinstance(node, nodes.field):
                assert len(node) == 2
                self.metadata[node[0].astext()] = node[1].astext()

        doctree.remove(doctree[0])
        self.doctree = doctree

    def write(self):
        writer = Writer()

        self.result = publish_parts(
            reader_name='doctree',
            writer=writer,
            source_class=DocTreeInput,
            settings_overrides=self.settings_overrides,
            source=self.doctree
        )
