const assert = require('node:assert/strict')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const test = require('node:test')

test('settings card registration provides a stable keyed-slot identity', async () => {
  const source = await readFile(path.join(__dirname, '..', 'lib', 'client.js'), 'utf8')

  assert.match(source, /name: 'settings\.section',[\s\S]{0,80}key: 'dsh-draw-router-settings'/)
})
