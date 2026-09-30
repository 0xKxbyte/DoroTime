# assets/audio

Coloque aqui um arquivo `alarm.mp3` para substituir o alarme.

O `index.html` já referencia `assets/audio/alarm.mp3` em um elemento `<audio>`.
Se o arquivo não existir (como nesta V1), o `main.js` detecta a falha e usa
automaticamente um alarme simples gerado por Web Audio API — então o app
funciona mesmo sem nenhum arquivo de áudio.

Ao adicionar seu próprio som, nenhuma mudança de código é necessária:
basta colocar o arquivo neste caminho com o nome `alarm.mp3`.
