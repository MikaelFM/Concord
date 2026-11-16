'use strict';
// janela de sobreposição (aparece por cima do jogo durante a chamada)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('overlay', {
  onState: (cb) => ipcRenderer.on('overlay-state', (e, st) => cb(st)),
  onMessage: (cb) => ipcRenderer.on('overlay-msg', (e, m) => cb(m)),
  onEdit: (cb) => ipcRenderer.on('overlay-edit', (e, d) => cb(d)),
  editDone: () => ipcRenderer.send('overlay-edit-done'),
});
