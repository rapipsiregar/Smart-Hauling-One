"""Marks ``tests`` as a regular package so it wins over ultralytics' own.

``ultralytics`` ships a top-level ``tests/`` package into site-packages. A
regular package (one with ``__init__.py``) takes precedence over a namespace
package, so without this file ``from tests.conftest import ...`` resolves to
*ultralytics'* tests instead of ours, and the whole suite fails to collect with
``cannot import name 'EDGE_TEST_CODE' from 'tests.conftest'``.

Since ultralytics is a core dependency of this project, that collision is
guaranteed on any complete install -- this file is what prevents it.
"""
