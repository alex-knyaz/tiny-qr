"use strict";

// {{{1 Initialize matrix with zeros
const init = (version) => {
    let N = version * 4 + 17;
    let matrix = [];
    let zeros = new Uint8Array(N);
    zeros.fill(0);
    zeros = [].slice.call(zeros);
    for (let i = 0; i < N; i++) {
        matrix[i] = zeros.slice();
    }
    return matrix;
}

// {{{1 Put finders into matrix
const fillFinders = (matrix) => {
    let N = matrix.length;
    for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
            let max = Math.max(i, j);
            let min = Math.min(i, j);
            let pixel = (max == 2 && min >= -2) || (min == -2 && max <= 2) ? 0x80 : 0x81;
            matrix[3 + i][3 + j] = pixel;
            matrix[3 + i][N - 4 + j] = pixel;
            matrix[N - 4 + i][3 + j] = pixel;
        }
    }
    for (let i = 0; i < 8; i++) {
        matrix[7][i] = matrix[i][7] =
            matrix[7][N - i - 1] = matrix[i][N - 8] =
            matrix[N - 8][i] = matrix[N - 1 - i][7] = 0x80;
    }
}

// {{{1 Put align and timinig
const fillAlignAndTiming = (matrix) => {
    let N = matrix.length;
    if (N > 21) {
        let len = N - 13;
        let delta = Math.round(len / Math.ceil(len / 28));
        if (delta % 2) delta++;
        let res = [];
        for (let p = len + 6; p > 10; p -= delta) {
            res.unshift(p);
        }
        res.unshift(6);
        for (let i = 0; i < res.length; i++) {
            for (let j = 0; j < res.length; j++) {
                let x = res[i], y = res[j];
                if (matrix[x][y]) continue;
                for (let r = -2; r <= 2; r++) {
                    for (let c = -2; c <= 2; c++) {
                        let max = Math.max(r, c);
                        let min = Math.min(r, c);
                        let pixel = (max == 1 && min >= -1) || (min == -1 && max <= 1) ? 0x80 : 0x81;
                        matrix[x + r][y + c] = pixel;
                    }
                }
            }
        }
    }
    for (let i = 8; i < N - 8; i++) {
        matrix[6][i] = matrix[i][6] = i % 2 ? 0x80 : 0x81;
    }
}

// {{{1 Fill reserved areas with zeroes
const fillStub = (matrix) => {
    let N = matrix.length;
    for (let i = 0; i < 8; i++) {
        if (i != 6) {
            matrix[8][i] = matrix[i][8] = 0x80;
        }
        matrix[8][N - 1 - i] = 0x80;
        matrix[N - 1 - i][8] = 0x80;
    }
    matrix[8][8] = 0x80;
    matrix[N - 8][8] = 0x81;

    if (N < 45) return;

    for (let i = N - 11; i < N - 8; i++) {
        for (let j = 0; j < 6; j++) {
            matrix[i][j] = matrix[j][i] = 0x80;
        }
    }
}

// {{{1 Fill reserved areas
var fillReserved = (() => {
    let FORMATS = Array(32);
    let VERSIONS = Array(40);

    let gf15 = 0x0537;
    let gf18 = 0x1f25;
    let formats_mask = 0x5412;

    for (let format = 0; format < 32; format++) {
        let res = format << 10;
        for (let i = 5; i > 0; i--) {
            if (res >>> (9 + i)) {
                res = res ^ (gf15 << (i - 1));
            }
        }
        FORMATS[format] = (res | (format << 10)) ^ formats_mask;
    }

    for (let version = 7; version <= 40; version++) {
        let res = version << 12;
        for (let i = 6; i > 0; i--) {
            if (res >>> (11 + i)) {
                res = res ^ (gf18 << (i - 1));
            }
        }
        VERSIONS[version] = (res | (version << 12));
    }

    const EC_LEVELS = { L: 1, M: 0, Q: 3, H: 2 };

    return fillReserved = (matrix, ec_level, mask) => {
        let N = matrix.length;
        let format = FORMATS[EC_LEVELS[ec_level] << 3 | mask];
        function F(k) { return format >> k & 1 ? 0x81 : 0x80 };
        for (let i = 0; i < 8; i++) {
            matrix[8][N - 1 - i] = F(i);
            if (i < 6) matrix[i][8] = F(i);
        }
        for (let i = 8; i < 15; i++) {
            matrix[N - 15 + i][8] = F(i);
            if (i > 8) matrix[8][14 - i] = F(i);
        }
        matrix[7][8] = F(6);
        matrix[8][8] = F(7);
        matrix[8][7] = F(8);

        let version = VERSIONS[(N - 17) / 4];
        if (!version) return;
        function V(k) { return version >> k & 1 ? 0x81 : 0x80 };
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 3; j++) {
                matrix[N - 11 + j][i] = matrix[i][N - 11 + j] = V(i * 3 + j);
            }
        }
    }
})();

// {{{1 Fill data
var fillData = (() => {
    const MASK_FUNCTIONS = [
        (i, j) => (i + j) % 2 == 0,
        (i, j) => i % 2 == 0,
        (i, j) => j % 3 == 0,
        (i, j) => (i + j) % 3 == 0,
        (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0,
        (i, j) => (i * j) % 2 + (i * j) % 3 == 0,
        (i, j) => ((i * j) % 2 + (i * j) % 3) % 2 == 0,
        (i, j) => ((i * j) % 3 + (i + j) % 2) % 2 == 0
    ];

    return fillData = (matrix, data, mask) => {
        let N = matrix.length;
        let row, col, dir = -1;
        row = col = N - 1;
        let mask_fn = MASK_FUNCTIONS[mask];
        let len = data.blocks[data.blocks.length - 1].length;

        for (let i = 0; i < len; i++) {
            for (let b = 0; b < data.blocks.length; b++) {
                if (data.blocks[b].length <= i) continue;
                put(data.blocks[b][i]);
            }
        }

        len = data.ec_len;
        for (let i = 0; i < len; i++) {
            for (let b = 0; b < data.ec.length; b++) {
                put(data.ec[b][i]);
            }
        }

        if (col > -1) {
            do {
                matrix[row][col] = mask_fn(row, col) ? 1 : 0;
            } while (next());
        }

        function put(byte) {
            for (let mask = 0x80; mask; mask = mask >> 1) {
                let pixel = !!(mask & byte);
                if (mask_fn(row, col)) pixel = !pixel;
                matrix[row][col] = pixel ? 1 : 0;
                next();
            }
        }

        function next() {
            do {
                if ((col % 2) ^ (col < 6)) {
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
                if (col == 6) { col--; }
                if (col < 0) { return false; }
            } while (matrix[row][col] & 0xf0);
            return true;
        }
    }
})();

// {{{1 Calculate penalty
const calculatePenalty = (matrix) => {
    let N = matrix.length;
    let penalty = 0;
    // Rule 1
    for (let i = 0; i < N; i++) {
        let pixel = matrix[i][0] & 1;
        let len = 1;
        for (let j = 1; j < N; j++) {
            let p = matrix[i][j] & 1;
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
    for (let j = 0; j < N; j++) {
        let pixel = matrix[0][j] & 1;
        let len = 1;
        for (let i = 1; i < N; i++) {
            let p = matrix[i][j] & 1;
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

    // Rule 2
    for (let i = 0; i < N - 1; i++) {
        for (let j = 0; j < N - 1; j++) {
            let s = matrix[i][j] + matrix[i][j + 1] + matrix[i + 1][j] + matrix[i + 1][j + 1] & 7;
            if (s == 0 || s == 4) {
                penalty += 3;
            }
        }
    }

    // Rule 3
    const I = (k) => matrix[i][j + k] & 1;
    const J = (k) => matrix[i + k][j] & 1;

    for (var i = 0; i < N; i++) {
        for (var j = 0; j < N; j++) {
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

    // Rule 4
    let numDark = 0;
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (matrix[i][j] & 1) numDark++;
        }
    }
    penalty += 10 * Math.floor(Math.abs(10 - 20 * numDark / (N * N)));

    return penalty;
}

// {{{1 All-in-one 
const getMatrix = (data) => {
    let matrix = init(data.version);
    fillFinders(matrix);
    fillAlignAndTiming(matrix);
    fillStub(matrix);

    let penalty = Infinity;
    let bestMask = 0;
    for (let mask = 0; mask < 8; mask++) {
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

    return matrix.map(row => row.map(cell => cell & 1));
}

// {{{1 export functions
export default { getMatrix }; 
