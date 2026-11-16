'use strict';
// Servidor WebSocket mínimo (RFC 6455), sem dependências externas.
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 1024 * 1024; // 1 MB por mensagem

class WSConn extends EventEmitter {
  constructor(socket, head) {
    super();
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frag = null;
    this.fragSize = 0;
    this.closed = false;
    this.alive = true;
    socket.setNoDelay(true);
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._close());
    socket.on('error', () => this._close());
    if (head && head.length) this._onData(head);
  }

  _onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (!this.closed) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0];
      const b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) return this.destroy();
        len = Number(big);
        off = 10;
      }
      if (len > MAX_MESSAGE) return this.destroy();
      if (!masked) return this.destroy(); // clientes sempre mascaram
      const maskOff = off;
      off += 4;
      if (this.buf.length < off + len) return;
      const mask = this.buf.subarray(maskOff, maskOff + 4);
      const payload = Buffer.from(this.buf.subarray(off, off + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + len);
      this._frame(fin, op, payload);
    }
  }

  _frame(fin, op, p) {
    switch (op) {
      case 0x8: // close
        this._send(0x8, p.subarray(0, 2));
        this.socket.end();
        this._close();
        return;
      case 0x9: // ping
        this._send(0xa, p);
        return;
      case 0xa: // pong
        this.alive = true;
        return;
      case 0x1:
      case 0x2:
        this.alive = true;
        if (fin) this.emit('message', p.toString('utf8'));
        else { this.frag = [p]; this.fragSize = p.length; }
        return;
      case 0x0:
        if (!this.frag) return;
        this.frag.push(p);
        this.fragSize += p.length;
        if (this.fragSize > MAX_MESSAGE) return this.destroy();
        if (fin) {
          const all = Buffer.concat(this.frag);
          this.frag = null;
          this.emit('message', all.toString('utf8'));
        }
        return;
      default:
        this.destroy();
    }
  }

  _send(op, payload) {
    if (this.closed || this.socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | op, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | op; header[1] = 126; header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | op; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(text) { this._send(0x1, Buffer.from(text, 'utf8')); }
  ping() { this._send(0x9, Buffer.alloc(0)); }

  destroy() {
    this.socket.destroy();
    this._close();
  }

  _close() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
}

// Faz o handshake e devolve a conexão, ou null se o pedido for inválido.
function acceptUpgrade(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  if ((req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key) {
    socket.destroy();
    return null;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  return new WSConn(socket, head);
}

module.exports = { acceptUpgrade };
