"use strict";

// {{{1 Galois Field Math
const GF256_BASE = 285;

let EXP_TABLE : number[] = [1];
let LOG_TABLE : number[] = [];

for (let i = 1; i < 256; i++) {
    let n = EXP_TABLE[i - 1] << 1;
    if (n > 255) n = n ^ GF256_BASE;
    EXP_TABLE[i] = n;
    LOG_TABLE[n] = i
}

const exp = (k: number) => EXP_TABLE[(k % 255 + 255) % 255];

const log = (k: number) => {
    if (k < 1 || k > 255) throw Error('Bad log(' + k + ')');
    return LOG_TABLE[k];
}

// {{{1 Generator Polynomials
let POLYNOMIALS = [
    [0], // a^0 x^0
    [0, 0], // a^0 x^1 + a^0 x^0
    [0, 25, 1], // a^0 x^2 + a^25 x^1 + a^1 x^0
    // and so on...
];

const generatorPolynomial = (num: number) => {
    if (POLYNOMIALS[num]) return POLYNOMIALS[num];

    let prev = generatorPolynomial(num - 1);
    let res: number[] = [];

    res[0] = prev[0];
    for (let i = 1; i <= num; i++) {
        res[i] = log(exp(prev[i]) ^ exp(prev[i - 1] + num - 1));
    }
    POLYNOMIALS[num] = res;
    return res;
}

// {{{1 export functions
const calculate_ec = (msg: Uint8Array, ec_len: number) => {
    // `msg` could be array or buffer
    // convert `msg` to array
    msg = [].slice.call(msg);

    // Generator Polynomial
    let poly = generatorPolynomial(ec_len);

    for (let i = 0; i < ec_len; i++) msg.push(0);
    while (msg.length > ec_len) {
        if (!msg[0]) {
            msg.shift();
            continue;
        }
        let log_k = log(msg[0]);
        for (let i = 0; i <= ec_len; i++) {
            msg[i] = msg[i] ^ exp(poly[i] + log_k);
        }
        msg.shift();
    }
    return new Uint8Array(msg);
}

export default calculate_ec;