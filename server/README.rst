========
README
========

development tips
=================

test
-------

.. code-block:: shell

  $ tox
  $ # show stdout
  $ tox -- -s

  # run async function on pdb
  $ tox -- --pdb
  (Pdb) import asyncio
  (Pdb) asyncio.run(res.json())
  {'error': 'Unxepected Content-Type'}

Update vendor css
--------------------

.. code-block:: shell

  $ cd client/static/vendor
  $ pygmentize -S default -f html > pygments/default.css
  $ cp /usr/local/lib/python3.8/site-packages/docutils/writers/html5_polyglot/math.css docutils/math.css
