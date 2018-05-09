process.stdin.resume();
process.stdin.setEncoding('utf8');

let stdin = '';
let results = [];

process.stdin.on('data', function (chunk) {
  const userInput = chunk;
  const arraySize = chunk.split(';')[0];
  const array     = chunk.split(';')[1].replace(/\r?\n|\r/g,'').split(',').sort();

  for(let i=0; i < array.length - 1; i++) {

    if(array[i+1] == array[i]) {
      results.push(array[i]);
    }
  }
  results.forEach((item, index, array) => {
    console.log(item);
  });
});
