var strftime = require('strftime')
var html = require('yo-yo')
var uniq = require('uniq')
var randomBytes = require('randombytes')

var root = document.querySelector('#content')

var state = {
  channels: [],
  channel: location.hash || '(status)',
  nym: randomBytes(3).toString('hex'),
  lines: {},
  activity: {}
}

var memdb = require('memdb')
var chat = require('./index.js')(state.nym, memdb())
chat.on('join', function (channel) {
  state.channels.push(channel)
  uniq(state.channels)
  state.channel = channel
  state.activity[channel] = false
  update()
})

chat.on('part', function (channel) {
  var ix = state.channels.indexOf(channel)
  if (ix >= 0) state.channels.splice(ix, 1)
  state.channel = state.channels[Math.max(0,ix-1)] || '(status)'
  state.activity[state.channel] = false
  update()
})

chat.on('say', function (channel, row) {
  if (!state.lines[channel]) state.lines[channel] = []
  state.lines[channel].push(row)
  state.lines[channel].sort(function (a, b) {
    return a.value.time < b.value.time ? -1 : 1
  })
  var nymre = RegExp('\\b' + chat.nym + '\\b')
  if (state.channel !== channel) {
    state.activity[channel] = nymre.test(row.value.message)
      ? 'mentioned' : 'activity'
  }
  update()
})

function update () {
  html.update(root, render(state))
}
update()
window.addEventListener('resize', update)

if (location.hash) chat.join(location.hash)

window.addEventListener('hashchange', function () {
  chat.join(location.hash)
})

var catchlinks = require('catch-links')
catchlinks(window, function (href) {
  var m = /(#.+)$/.exec(href)
  if (m) {
    state.channel = m[1]
    state.activity[state.channel] = false
    update()
  }
})

function render (state) {
  location.hash = state.channel
  return html`<div id="content">
    <div class="channels"><div class="inner">
      ${state.channels.map(function (channel) {
        var c = state.activity[channel] || ''
        if (state.channel === channel) c = 'current'
        return html`<div class="channel">
          <a href="${channel}" class="${c}">${channel}</a>
        </div>`
      })}
    </div></div>
    <div class="lines"><div class="inner">
      ${(state.lines[state.channel] || []).map(function (row) {
        var m = row.value
        return html`<div class="line">
          <span class="time">${strftime('%T', new Date(m.time))}</span>
          <span class="who">${'<' + m.who + '>'}</span>
          <span class="message">${m.message}</span>
        </div>`
      })}
    </div></div>
    <form class="input" onsubmit=${onsubmit}>
      [${state.channel}]
      <input type="text" name="text" onblur=${onblur}
        autofocus
        style="width: calc(100% - ${state.channel.length+6}ex)">
    </form>
  </div>`
  function onblur () { this.focus() }
  function onsubmit (ev) {
    ev.preventDefault()
    var msg = this.elements.text.value
    this.reset()
    handleMsg(msg)
  }
}

function handleMsg (msg) {
  var m = /^\/(\S+)/.exec(msg)
  var cmd = (m && m[1] || '').toLowerCase()
  if (cmd === 'join' || cmd === 'j') {
    chat.join(msg.split(/\s+/)[1] || state.channel)
  } else if (cmd === 'part' || cmd === 'p') {
    chat.part(msg.split(/\s+/)[1] || state.channel)
  } else if (cmd === 'nick' || cmd === 'n') {
    chat.nym = msg.split(/\s+/)[1]
    update()
  } else if (cmd) {
    // unknown command
  } else if (state.channel !== '(status)') {
    chat.say(state.channel, msg)
  }
}
