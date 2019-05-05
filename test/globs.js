'use strict';
const path = require('path');
const tap = require('tap');
const globs = require('../lib/globs');

const {test} = tap;

tap.afterEach(done => {
	// We changed the CWD in some of the tests
	process.chdir(path.resolve(__dirname, '..'));
	done();
});

function fixture(...args) {
	args.unshift(__dirname, 'fixture', 'globs');
	return path.join(...args);
}

test('ignores relativeness in patterns', t => {
	const {testPatterns} = globs.normalizeGlobs(['./foo.js', '!./bar'], undefined, undefined, ['js']);
	t.deepEqual(testPatterns, ['foo.js', '!bar']);
	t.end();
});

test('isTest', t => {
	const options = globs.normalizeGlobs(
		['**/foo*.js', '**/foo*/**/*.js', '!**/fixtures', '!**/helpers'],
		undefined,
		undefined,
		['js']
	);

	function isTest(file) {
		t.true(globs.classify(fixture(file), options).isTest, `${file} should be a test`);
	}

	function notTest(file) {
		t.false(globs.classify(fixture(file), options).isTest, `${file} should not be a test`);
	}

	isTest('foo-bar.js');
	isTest('foo.js');
	isTest('foo/blah.js');
	isTest('bar/foo.js');
	isTest('bar/foo-bar/baz/buz.js');
	notTest('bar/baz/buz.js');
	notTest('bar.js');
	notTest('bar/bar.js');
	notTest('_foo-bar.js');
	notTest('foo/_foo-bar.js');
	notTest('foo-bar.txt');
	notTest('node_modules/foo.js');
	notTest('fixtures/foo.js');
	notTest('helpers/foo.js');
	t.end();
});

test('isSource with defaults', t => {
	const options = globs.normalizeGlobs(undefined, undefined, undefined, ['js']);

	function isSource(file) {
		t.true(globs.classify(file, options).isSource, `${file} should be a source`);
	}

	function notSource(file) {
		t.false(globs.classify(file, options).isSource, `${file} should not be a source`);
	}

	isSource('foo-bar.js');
	isSource('foo.js');
	isSource('foo/blah.js');
	isSource('bar/foo.js');

	notSource('_foo-bar.js');
	notSource('foo/_foo-bar.js');
	isSource('fixtures/foo.js');
	isSource('helpers/foo.js');

	isSource('snapshots/foo.js.snap');
	isSource('snapshots/bar.js.snap');

	// TODO: Watcher should probably track any required file that matches the source pattern and has a require extension installed for the given extension.
	notSource('foo-bar.json');
	notSource('foo-bar.coffee');

	// These seem OK
	isSource('bar.js');
	isSource('bar/bar.js');
	notSource('node_modules/foo.js');
	t.end();
});

test('isSource with negation negation patterns', t => {
	const options = globs.normalizeGlobs(
		['**/foo*'],
		undefined,
		['!**/bar*'],
		['js']
	);

	t.false(globs.classify('node_modules/foo/foo.js', options).isSource);
	t.false(globs.classify('bar.js', options).isSource);
	t.false(globs.classify('foo/bar.js', options).isSource);
	t.end();
});

test('isHelper (prefixed only)', t => {
	const options = globs.normalizeGlobs(undefined, undefined, undefined, ['js']);

	function isHelper(file) {
		t.true(globs.classify(file, options).isHelper, `${file} should be a helper`);
	}

	function notHelper(file) {
		t.false(globs.classify(file, options).isHelper, `${file} should not be a helper`);
	}

	notHelper('foo-bar.js');
	notHelper('foo.js');
	notHelper('foo/blah.js');
	notHelper('bar/foo.js');

	isHelper('_foo-bar.js');
	isHelper('foo/_foo-bar.js');
	notHelper('fixtures/foo.js');
	notHelper('helpers/foo.js');

	notHelper('snapshots/foo.js.snap');
	notHelper('snapshots/bar.js.snap');

	notHelper('foo-bar.json');
	notHelper('foo-bar.coffee');

	// These seem OK
	notHelper('bar.js');
	notHelper('bar/bar.js');
	notHelper('node_modules/foo.js');
	t.end();
});

test('isHelper (with patterns)', t => {
	const options = globs.normalizeGlobs(undefined, ['**/f*.*'], undefined, ['js']);

	function isHelper(file) {
		t.true(globs.classify(file, options).isHelper, `${file} should be a helper`);
	}

	function notHelper(file) {
		t.false(globs.classify(file, options).isHelper, `${file} should not be a helper`);
	}

	isHelper('foo-bar.js');
	isHelper('foo.js');
	notHelper('foo/blah.js');
	isHelper('bar/foo.js');

	isHelper('_foo-bar.js');
	isHelper('foo/_foo-bar.js');
	isHelper('fixtures/foo.js');
	isHelper('helpers/foo.js');

	notHelper('snapshots/foo.js.snap');
	notHelper('snapshots/bar.js.snap');

	notHelper('foo-bar.json');
	notHelper('foo-bar.coffee');

	// These seem OK
	notHelper('bar.js');
	notHelper('bar/bar.js');
	notHelper('node_modules/foo.js');
	t.end();
});

test('findHelpersAndTests finds tests (just .js)', async t => {
	const fixtureDir = fixture('default-patterns');
	process.chdir(fixtureDir);

	const expected = [
		'sub/directory/__tests__/foo.js',
		'sub/directory/bar.spec.js',
		'sub/directory/bar.test.js',
		'test-foo.js',
		'test.js',
		'test/baz.js',
		'test/deep/deep.js'
	].map(file => path.join(fixtureDir, file)).sort();

	const {tests: actual} = await globs.findHelpersAndTests({
		cwd: fixtureDir,
		...globs.normalizeGlobs(['!**/fixtures/*.*', '!**/helpers/*.*'], undefined, undefined, ['js'])
	});
	actual.sort();
	t.deepEqual(actual, expected);
});

test('findHelpersAndTests finds tests (.js, .jsx)', async t => {
	const fixtureDir = fixture('custom-extension');
	process.chdir(fixtureDir);

	const expected = [
		'test/do-not-compile.js',
		'test/foo.jsx',
		'test/sub/bar.jsx'
	].sort().map(file => path.join(fixtureDir, file));

	const {tests: actual} = await globs.findHelpersAndTests({
		cwd: fixtureDir,
		...globs.normalizeGlobs(['!**/fixtures/*.*', '!**/helpers/*.*'], undefined, undefined, ['js', 'jsx'])
	});
	actual.sort();
	t.deepEqual(actual, expected);
});

test('findHelpersAndTests finds helpers (just .js)', async t => {
	const fixtureDir = fixture('default-patterns');
	process.chdir(fixtureDir);

	const expected = [
		'sub/directory/__tests__/helpers/foo.js',
		'sub/directory/__tests__/_foo.js',
		'test/helpers/test.js',
		'test/_foo-help.js'
	].sort().map(file => path.join(fixtureDir, file));

	const {helpers: actual} = await globs.findHelpersAndTests({
		cwd: fixtureDir,
		...globs.normalizeGlobs(undefined, ['**/helpers/*'], undefined, ['js'])
	});
	actual.sort();
	t.deepEqual(actual, expected);
});

test('findHelpersAndTests finds helpers (.js and .jsx)', async t => {
	const fixtureDir = fixture('custom-extension');
	process.chdir(fixtureDir);

	const expected = [
		'test/sub/_helper.jsx',
		'test/helpers/a.jsx',
		'test/helpers/b.js'
	].sort().map(file => path.join(fixtureDir, file));

	const {helpers: actual} = await globs.findHelpersAndTests({
		cwd: fixtureDir,
		...globs.normalizeGlobs(undefined, ['**/helpers/*'], undefined, ['js', 'jsx'])
	});
	actual.sort();
	t.deepEqual(actual, expected);
});
