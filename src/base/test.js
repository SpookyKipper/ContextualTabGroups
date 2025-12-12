import punycode from "./punycode.js";
console.log(punycode.decode('maana-pta.com')); // 'mañana'
console.log(punycode.decode('--dqo34k')); // '☃-⌘'