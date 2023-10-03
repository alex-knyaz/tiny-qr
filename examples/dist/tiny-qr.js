// lib/encode.ts
var pushBits = (arr, n, value) => {
  for (let x = 1 << n - 1;x; x = x >>> 1)
    arr.push(x & value ? 1 : 0);
};
var encode_8bit = (data) => {
  let len = data.length;
  let bits = [];
  for (let i = 0;i < len; i++)
    pushBits(bits, 8, data[i]);
  let res = {};
  let d = [0, 1, 0, 0];
  pushBits(d, 16, len);
  res.data10 = res.data27 = d.concat(bits);
  if (len < 256) {
    let d2 = [0, 1, 0, 0];
    pushBits(d2, 8, len);
    res.data1 = d2.concat(bits);
  }
  return res;
};
var ALPHANUM = ((s) => {
  let res = {};
  for (let i = 0;i < s.length; i++)
    res[s[i]] = i;
  return res;
})("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:");
var encode_alphanum = (str) => {
  let len = str.length;
  let bits = [];
  for (let i = 0;i < len; i += 2) {
    let b = 6;
    let n = ALPHANUM[str[i]];
    if (str[i + 1]) {
      b = 11;
      n = n * 45 + ALPHANUM[str[i + 1]];
    }
    pushBits(bits, b, n);
  }
  let res = {};
  let d = [0, 0, 1, 0];
  pushBits(d, 13, len);
  res.data27 = d.concat(bits);
  if (len < 2048) {
    let d2 = [0, 0, 1, 0];
    pushBits(d2, 11, len);
    res.data10 = d2.concat(bits);
  }
  if (len < 512) {
    let d2 = [0, 0, 1, 0];
    pushBits(d2, 9, len);
    res.data1 = d2.concat(bits);
  }
  return res;
};
var encode_numeric = (str) => {
  let len = str.length;
  let bits = [];
  for (let i = 0;i < len; i += 3) {
    let s = str.substr(i, 3);
    let b = Math.ceil(s.length * 10 / 3);
    pushBits(bits, b, parseInt(s, 10));
  }
  let res = {};
  let d = [0, 0, 0, 1];
  pushBits(d, 14, len);
  res.data27 = d.concat(bits);
  if (len < 4096) {
    let d2 = [0, 0, 0, 1];
    pushBits(d2, 12, len);
    res.data10 = d2.concat(bits);
  }
  if (len < 1024) {
    let d2 = [0, 0, 0, 1];
    pushBits(d2, 10, len);
    res.data1 = d2.concat(bits);
  }
  return res;
};
var encode_url = (str) => {
  let slash = str.indexOf("/", 8) + 1 || str.length;
  let res = encode(str.slice(0, slash).toUpperCase(), false);
  if (slash >= str.length)
    return res;
  let path_res = encode(str.slice(slash), false);
  res.data27 = res.data27.concat(path_res.data27);
  if (res.data10 && path_res.data10) {
    res.data10 = res.data10.concat(path_res.data10);
  }
  if (res.data1 && path_res.data1) {
    res.data1 = res.data1.concat(path_res.data1);
  }
  return res;
};
var encode = (data, parse_url) => {
  let str;
  let t = typeof data;
  if (t == "string" || t == "number") {
    str = "" + data;
    data = new TextEncoder().encode(str);
  } else if (data instanceof Uint8Array) {
    str = data.toString();
  } else if (Array.isArray(data)) {
    data = new TextEncoder().encode(str);
    str = data.toString();
  } else {
    throw new Error("Bad data");
  }
  if (/^[0-9]+$/.test(str)) {
    if (data.length > 7089) {
      throw new Error("Too much data");
    }
    return encode_numeric(str);
  }
  if (/^[0-9A-Z \$%\*\+\.\/\:\-]+$/.test(str)) {
    if (data.length > 4296) {
      throw new Error("Too much data");
    }
    return encode_alphanum(str);
  }
  if (parse_url && /^https?:/i.test(str)) {
    return encode_url(str);
  }
  if (data.length > 2953)
    throw new Error("Too much data");
  return encode_8bit(data);
};
var encode_default = encode;

// lib/errorcode.ts
var GF256_BASE = 285;
var EXP_TABLE = [1];
var LOG_TABLE = [];
for (let i = 1;i < 256; i++) {
  let n = EXP_TABLE[i - 1] << 1;
  if (n > 255)
    n = n ^ GF256_BASE;
  EXP_TABLE[i] = n;
  LOG_TABLE[n] = i;
}
var exp = (k) => EXP_TABLE[(k % 255 + 255) % 255];
var log = (k) => {
  if (k < 1 || k > 255)
    throw Error("Bad log(" + k + ")");
  return LOG_TABLE[k];
};
var POLYNOMIALS = [
  [0],
  [0, 0],
  [0, 25, 1]
];
var generatorPolynomial = (num) => {
  if (POLYNOMIALS[num])
    return POLYNOMIALS[num];
  let prev = generatorPolynomial(num - 1);
  let res = [];
  res[0] = prev[0];
  for (let i = 1;i <= num; i++) {
    res[i] = log(exp(prev[i]) ^ exp(prev[i - 1] + num - 1));
  }
  POLYNOMIALS[num] = res;
  return res;
};
var calculate_ec = (msg, ec_len) => {
  msg = [].slice.call(msg);
  let poly = generatorPolynomial(ec_len);
  for (let i = 0;i < ec_len; i++)
    msg.push(0);
  while (msg.length > ec_len) {
    if (!msg[0]) {
      msg.shift();
      continue;
    }
    let log_k = log(msg[0]);
    for (let i = 0;i <= ec_len; i++) {
      msg[i] = msg[i] ^ exp(poly[i] + log_k);
    }
    msg.shift();
  }
  return new Uint8Array(msg);
};
var errorcode_default = calculate_ec;

// lib/matrix.ts
var init = (version) => {
  let N = version * 4 + 17;
  let matrix = [];
  let zeros = new Uint8Array(N);
  zeros.fill(0);
  zeros = [].slice.call(zeros);
  for (let i = 0;i < N; i++) {
    matrix[i] = zeros.slice();
  }
  return matrix;
};
var fillFinders = (matrix) => {
  let N = matrix.length;
  for (let i = -3;i <= 3; i++) {
    for (let j = -3;j <= 3; j++) {
      let max = Math.max(i, j);
      let min = Math.min(i, j);
      let pixel = max == 2 && min >= -2 || min == -2 && max <= 2 ? 128 : 129;
      matrix[3 + i][3 + j] = pixel;
      matrix[3 + i][N - 4 + j] = pixel;
      matrix[N - 4 + i][3 + j] = pixel;
    }
  }
  for (let i = 0;i < 8; i++) {
    matrix[7][i] = matrix[i][7] = matrix[7][N - i - 1] = matrix[i][N - 8] = matrix[N - 8][i] = matrix[N - 1 - i][7] = 128;
  }
};
var fillAlignAndTiming = (matrix) => {
  let N = matrix.length;
  if (N > 21) {
    let len = N - 13;
    let delta = Math.round(len / Math.ceil(len / 28));
    if (delta % 2)
      delta++;
    let res = [];
    for (let p = len + 6;p > 10; p -= delta) {
      res.unshift(p);
    }
    res.unshift(6);
    for (let i = 0;i < res.length; i++) {
      for (let j = 0;j < res.length; j++) {
        let x = res[i], y = res[j];
        if (matrix[x][y])
          continue;
        for (let r = -2;r <= 2; r++) {
          for (let c = -2;c <= 2; c++) {
            let max = Math.max(r, c);
            let min = Math.min(r, c);
            let pixel = max == 1 && min >= -1 || min == -1 && max <= 1 ? 128 : 129;
            matrix[x + r][y + c] = pixel;
          }
        }
      }
    }
  }
  for (let i = 8;i < N - 8; i++) {
    matrix[6][i] = matrix[i][6] = i % 2 ? 128 : 129;
  }
};
var fillStub = (matrix) => {
  let N = matrix.length;
  for (let i = 0;i < 8; i++) {
    if (i != 6) {
      matrix[8][i] = matrix[i][8] = 128;
    }
    matrix[8][N - 1 - i] = 128;
    matrix[N - 1 - i][8] = 128;
  }
  matrix[8][8] = 128;
  matrix[N - 8][8] = 129;
  if (N < 45)
    return;
  for (let i = N - 11;i < N - 8; i++) {
    for (let j = 0;j < 6; j++) {
      matrix[i][j] = matrix[j][i] = 128;
    }
  }
};
var fillReserved = (() => {
  let FORMATS = Array(32);
  let VERSIONS = Array(40);
  let gf15 = 1335;
  let gf18 = 7973;
  let formats_mask = 21522;
  for (let format = 0;format < 32; format++) {
    let res = format << 10;
    for (let i = 5;i > 0; i--) {
      if (res >>> 9 + i) {
        res = res ^ gf15 << i - 1;
      }
    }
    FORMATS[format] = (res | format << 10) ^ formats_mask;
  }
  for (let version = 7;version <= 40; version++) {
    let res = version << 12;
    for (let i = 6;i > 0; i--) {
      if (res >>> 11 + i) {
        res = res ^ gf18 << i - 1;
      }
    }
    VERSIONS[version] = res | version << 12;
  }
  const EC_LEVELS = { L: 1, M: 0, Q: 3, H: 2 };
  return fillReserved = (matrix, ec_level, mask) => {
    let N = matrix.length;
    let format = FORMATS[EC_LEVELS[ec_level] << 3 | mask];
    function F(k) {
      return format >> k & 1 ? 129 : 128;
    }
    for (let i = 0;i < 8; i++) {
      matrix[8][N - 1 - i] = F(i);
      if (i < 6)
        matrix[i][8] = F(i);
    }
    for (let i = 8;i < 15; i++) {
      matrix[N - 15 + i][8] = F(i);
      if (i > 8)
        matrix[8][14 - i] = F(i);
    }
    matrix[7][8] = F(6);
    matrix[8][8] = F(7);
    matrix[8][7] = F(8);
    let version = VERSIONS[(N - 17) / 4];
    if (!version)
      return;
    function V(k) {
      return version >> k & 1 ? 129 : 128;
    }
    for (let i = 0;i < 6; i++) {
      for (let j = 0;j < 3; j++) {
        matrix[N - 11 + j][i] = matrix[i][N - 11 + j] = V(i * 3 + j);
      }
    }
  };
})();
var fillData = (() => {
  const MASK_FUNCTIONS = [
    (i, j) => (i + j) % 2 == 0,
    (i, j) => i % 2 == 0,
    (i, j) => j % 3 == 0,
    (i, j) => (i + j) % 3 == 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0,
    (i, j) => i * j % 2 + i * j % 3 == 0,
    (i, j) => (i * j % 2 + i * j % 3) % 2 == 0,
    (i, j) => (i * j % 3 + (i + j) % 2) % 2 == 0
  ];
  return fillData = (matrix, data, mask) => {
    let N = matrix.length;
    let row, col, dir = -1;
    row = col = N - 1;
    let mask_fn = MASK_FUNCTIONS[mask];
    let len = data.blocks[data.blocks.length - 1].length;
    for (let i = 0;i < len; i++) {
      for (let b = 0;b < data.blocks.length; b++) {
        if (data.blocks[b].length <= i)
          continue;
        put(data.blocks[b][i]);
      }
    }
    len = data.ec_len;
    for (let i = 0;i < len; i++) {
      for (let b = 0;b < data.ec.length; b++) {
        put(data.ec[b][i]);
      }
    }
    if (col > -1) {
      do {
        matrix[row][col] = mask_fn(row, col) ? 1 : 0;
      } while (next());
    }
    function put(byte) {
      for (let mask2 = 128;mask2; mask2 = mask2 >> 1) {
        let pixel = !!(mask2 & byte);
        if (mask_fn(row, col))
          pixel = !pixel;
        matrix[row][col] = pixel ? 1 : 0;
        next();
      }
    }
    function next() {
      do {
        if (col % 2 ^ col < 6) {
          if (dir < 0 && row == 0 || dir > 0 && row == N - 1) {
            col--;
            dir = -dir;
          } else {
            col++;
            row += dir;
          }
        } else {
          col--;
        }
        if (col == 6) {
          col--;
        }
        if (col < 0) {
          return false;
        }
      } while (matrix[row][col] & 240);
      return true;
    }
  };
})();
var calculatePenalty = (matrix) => {
  let N = matrix.length;
  let penalty = 0;
  for (let i2 = 0;i2 < N; i2++) {
    let pixel = matrix[i2][0] & 1;
    let len = 1;
    for (let j2 = 1;j2 < N; j2++) {
      let p = matrix[i2][j2] & 1;
      if (p == pixel) {
        len++;
        continue;
      }
      if (len >= 5) {
        penalty += len - 2;
      }
      pixel = p;
      len = 1;
    }
    if (len >= 5) {
      penalty += len - 2;
    }
  }
  for (let j2 = 0;j2 < N; j2++) {
    let pixel = matrix[0][j2] & 1;
    let len = 1;
    for (let i2 = 1;i2 < N; i2++) {
      let p = matrix[i2][j2] & 1;
      if (p == pixel) {
        len++;
        continue;
      }
      if (len >= 5) {
        penalty += len - 2;
      }
      pixel = p;
      len = 1;
    }
    if (len >= 5) {
      penalty += len - 2;
    }
  }
  for (let i2 = 0;i2 < N - 1; i2++) {
    for (let j2 = 0;j2 < N - 1; j2++) {
      let s = matrix[i2][j2] + matrix[i2][j2 + 1] + matrix[i2 + 1][j2] + matrix[i2 + 1][j2 + 1] & 7;
      if (s == 0 || s == 4) {
        penalty += 3;
      }
    }
  }
  const I = (k) => matrix[i][j + k] & 1;
  const J = (k) => matrix[i + k][j] & 1;
  for (var i = 0;i < N; i++) {
    for (var j = 0;j < N; j++) {
      if (j < N - 6 && I(0) && !I(1) && I(2) && I(3) && I(4) && !I(5) && I(6)) {
        if (j >= 4 && !(I(-4) || I(-3) || I(-2) || I(-1))) {
          penalty += 40;
        }
        if (j < N - 10 && !(I(7) || I(8) || I(9) || I(10))) {
          penalty += 40;
        }
      }
      if (i < N - 6 && J(0) && !J(1) && J(2) && J(3) && J(4) && !J(5) && J(6)) {
        if (i >= 4 && !(J(-4) || J(-3) || J(-2) || J(-1))) {
          penalty += 40;
        }
        if (i < N - 10 && !(J(7) || J(8) || J(9) || J(10))) {
          penalty += 40;
        }
      }
    }
  }
  let numDark = 0;
  for (let i2 = 0;i2 < N; i2++) {
    for (let j2 = 0;j2 < N; j2++) {
      if (matrix[i2][j2] & 1)
        numDark++;
    }
  }
  penalty += 10 * Math.floor(Math.abs(10 - 20 * numDark / (N * N)));
  return penalty;
};
var getMatrix = (data) => {
  let matrix = init(data.version);
  fillFinders(matrix);
  fillAlignAndTiming(matrix);
  fillStub(matrix);
  let penalty = Infinity;
  let bestMask = 0;
  for (let mask = 0;mask < 8; mask++) {
    fillData(matrix, data, mask);
    fillReserved(matrix, data.ec_level, mask);
    let p = calculatePenalty(matrix);
    if (p < penalty) {
      penalty = p;
      bestMask = mask;
    }
  }
  fillData(matrix, data, bestMask);
  fillReserved(matrix, data.ec_level, bestMask);
  return matrix.map((row) => row.map((cell) => cell & 1));
};
var matrix_default = { getMatrix };

// lib/qr-base.ts
var version_deep_copy = (obj) => {
  let res = Object.assign({}, obj);
  res.blocks = [...res.blocks];
  res.ec = [...res.ec];
  return res;
};
var EC_LEVELS = ["L", "M", "Q", "H"];
var versions = [
  [],
  [26, 7, 1, 10, 1, 13, 1, 17, 1],
  [44, 10, 1, 16, 1, 22, 1, 28, 1],
  [70, 15, 1, 26, 1, 36, 2, 44, 2],
  [100, 20, 1, 36, 2, 52, 2, 64, 4],
  [134, 26, 1, 48, 2, 72, 4, 88, 4],
  [172, 36, 2, 64, 4, 96, 4, 112, 4],
  [196, 40, 2, 72, 4, 108, 6, 130, 5],
  [242, 48, 2, 88, 4, 132, 6, 156, 6],
  [292, 60, 2, 110, 5, 160, 8, 192, 8],
  [346, 72, 4, 130, 5, 192, 8, 224, 8],
  [404, 80, 4, 150, 5, 224, 8, 264, 11],
  [466, 96, 4, 176, 8, 260, 10, 308, 11],
  [532, 104, 4, 198, 9, 288, 12, 352, 16],
  [581, 120, 4, 216, 9, 320, 16, 384, 16],
  [655, 132, 6, 240, 10, 360, 12, 432, 18],
  [733, 144, 6, 280, 10, 408, 17, 480, 16],
  [815, 168, 6, 308, 11, 448, 16, 532, 19],
  [901, 180, 6, 338, 13, 504, 18, 588, 21],
  [991, 196, 7, 364, 14, 546, 21, 650, 25],
  [1085, 224, 8, 416, 16, 600, 20, 700, 25],
  [1156, 224, 8, 442, 17, 644, 23, 750, 25],
  [1258, 252, 9, 476, 17, 690, 23, 816, 34],
  [1364, 270, 9, 504, 18, 750, 25, 900, 30],
  [1474, 300, 10, 560, 20, 810, 27, 960, 32],
  [1588, 312, 12, 588, 21, 870, 29, 1050, 35],
  [1706, 336, 12, 644, 23, 952, 34, 1110, 37],
  [1828, 360, 12, 700, 25, 1020, 34, 1200, 40],
  [1921, 390, 13, 728, 26, 1050, 35, 1260, 42],
  [2051, 420, 14, 784, 28, 1140, 38, 1350, 45],
  [2185, 450, 15, 812, 29, 1200, 40, 1440, 48],
  [2323, 480, 16, 868, 31, 1290, 43, 1530, 51],
  [2465, 510, 17, 924, 33, 1350, 45, 1620, 54],
  [2611, 540, 18, 980, 35, 1440, 48, 1710, 57],
  [2761, 570, 19, 1036, 37, 1530, 51, 1800, 60],
  [2876, 570, 19, 1064, 38, 1590, 53, 1890, 63],
  [3034, 600, 20, 1120, 40, 1680, 56, 1980, 66],
  [3196, 630, 21, 1204, 43, 1770, 59, 2100, 70],
  [3362, 660, 22, 1260, 45, 1860, 62, 2220, 74],
  [3532, 720, 24, 1316, 47, 1950, 65, 2310, 77],
  [3706, 750, 25, 1372, 49, 2040, 68, 2430, 81]
];
versions = versions.map((v, index) => {
  if (!index)
    return {};
  let res = {};
  for (let i = 1;i < 8; i += 2) {
    let length = v[0] - v[i];
    let num_template = v[i + 1];
    let ec_level = EC_LEVELS[i / 2 | 0];
    let level = {
      version: index,
      ec_level,
      data_len: length,
      ec_len: v[i] / num_template,
      blocks: [],
      ec: []
    };
    for (let k = num_template, n = length;k > 0; k--) {
      let block = n / k | 0;
      level.blocks.push(block);
      n -= block;
    }
    res[ec_level] = level;
  }
  return res;
});
var getTemplate = (message, ec_level) => {
  let i = 1;
  let len;
  if (message.data1) {
    len = Math.ceil(message.data1.length / 8);
  } else {
    i = 10;
  }
  for (;i < 10; i++) {
    let version = versions[i][ec_level];
    if (version.data_len >= len)
      return version_deep_copy(version);
  }
  if (message.data10) {
    len = Math.ceil(message.data10.length / 8);
  } else {
    i = 27;
  }
  for (;i < 27; i++) {
    let version = versions[i][ec_level];
    if (version.data_len >= len)
      return version_deep_copy(version);
  }
  len = Math.ceil(message.data27.length / 8);
  for (;i < 41; i++) {
    let version = versions[i][ec_level];
    if (version.data_len >= len)
      return version_deep_copy(version);
  }
  throw new Error("Too much data");
};
var fillTemplate = (message, template) => {
  let blocks = new Uint8Array(template.data_len);
  blocks.fill(0);
  if (template.version < 10) {
    message = message.data1;
  } else if (template.version < 27) {
    message = message.data10;
  } else {
    message = message.data27;
  }
  let len = message.length;
  for (let i = 0;i < len; i += 8) {
    let b = 0;
    for (let j = 0;j < 8; j++) {
      b = b << 1 | (message[i + j] ? 1 : 0);
    }
    blocks[i / 8] = b;
  }
  let pad = 236;
  for (let i = Math.ceil((len + 4) / 8);i < blocks.length; i++) {
    blocks[i] = pad;
    pad = pad == 236 ? 17 : 236;
  }
  let offset = 0;
  template.blocks = template.blocks.map(function(n) {
    let b = blocks.slice(offset, offset + n);
    offset += n;
    template.ec.push(errorcode_default(b, template.ec_len));
    return b;
  });
  return template;
};
var bit_matrix = (text, ec_level, parse_url) => {
  ec_level = EC_LEVELS.indexOf(ec_level) > -1 ? ec_level : "M";
  let message = encode_default(text, parse_url);
  let data = fillTemplate(message, getTemplate(message, ec_level));
  return matrix_default.getMatrix(data);
};
var get_ASCII_image = (text, ec_level, parse_url) => {
  const matrix2 = bit_matrix(text, ec_level, parse_url);
  let string = "";
  matrix2.forEach((row) => {
    row.forEach((cell) => string += cell ? "\u2588\u2588" : "\u2000\u2000");
    string += "\n";
  });
  return string;
};
var get_html_image = (text, ec_level, parse_url, cell_size = "15px", style_filled = "background-color: black;") => {
  const matrix2 = bit_matrix(text, ec_level, parse_url);
  let cols_count = matrix2[0].length;
  let string = `<div style='display: grid; grid-template-columns: repeat(${cols_count}, ${cell_size});'>`;
  const add_span = (block_start, block_count) => string += `<span style="${style_filled} grid-column: ${block_start} / span ${block_count};">&nbsp;</span>`;
  for (let i = 0;i < matrix2.length; i++) {
    let prev = matrix2[i][0];
    let block_start = 1;
    let block_count = 0;
    for (let j = 0;j < matrix2[i].length; j++) {
      if (prev == matrix2[i][j]) {
        block_count++;
        continue;
      }
      if (prev) {
        add_span(block_start, block_count);
      } else {
        block_start = j + 1;
      }
      block_count = 1;
      prev = matrix2[i][j];
    }
    if (prev)
      add_span(block_start, block_count);
  }
  string += "</div>";
  return string;
};
export {
  get_html_image,
  get_ASCII_image,
  bit_matrix
};
