"use strict";



type bit = 0 | 1

const pushBits = (arr: bit[], n: number, value: number) => {
    // x is mask
    for (let x = 1 << (n - 1); x; x = x >>> 1) arr.push(x & value ? 1 : 0);
}

// {{{1 8bit encode
const encode_8bit = (data: Uint8Array) => {
    let len = data.length;
    let bits = [];
    for (let i = 0; i < len; i++) pushBits(bits, 8, data[i]);
    let res = {};

    let d: bit[] = [0, 1, 0, 0];
    pushBits(d, 16, len);
    res.data10 = res.data27 = d.concat(bits);

    if (len < 256) {
        let d: bit[] = [0, 1, 0, 0];
        pushBits(d, 8, len);
        res.data1 = d.concat(bits);
    }

    return res;
}

// {{{1 alphanumeric encode
const ALPHANUM = ((s) => {
    let res = {};
    for (let i = 0; i < s.length; i++) res[s[i]] = i;
    return res;
})('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:');

const encode_alphanum = (str: string) => {

    let len = str.length;
    let bits = [];

    for (let i = 0; i < len; i += 2) {
        let b = 6;
        let n = ALPHANUM[str[i]];

        if (str[i + 1]) {
            b = 11;
            n = n * 45 + ALPHANUM[str[i + 1]];
        }
        pushBits(bits, b, n);
    }

    let res = {};

    let d: bit[] = [0, 0, 1, 0];
    pushBits(d, 13, len);
    res.data27 = d.concat(bits);

    if (len < 2048) {
        let d: bit[] = [0, 0, 1, 0];
        pushBits(d, 11, len);
        res.data10 = d.concat(bits);
    }

    if (len < 512) {
        let d: bit[] = [0, 0, 1, 0];
        pushBits(d, 9, len);
        res.data1 = d.concat(bits);
    }

    return res;
}

// {{{1 numeric encode
const encode_numeric = (str: string) => {
    let len = str.length;
    let bits = [];

    for (let i = 0; i < len; i += 3) {
        let s = str.substr(i, 3);
        let b = Math.ceil(s.length * 10 / 3);
        pushBits(bits, b, parseInt(s, 10));
    }

    let res = {};

    let d: bit[] = [0, 0, 0, 1];
    pushBits(d, 14, len);
    res.data27 = d.concat(bits);

    if (len < 4096) {
        let d: bit[] = [0, 0, 0, 1];
        pushBits(d, 12, len);
        res.data10 = d.concat(bits);
    }

    if (len < 1024) {
        let d: bit[] = [0, 0, 0, 1];
        pushBits(d, 10, len);
        res.data1 = d.concat(bits);
    }

    return res;
}

// {{{1 url encode
const encode_url = (str: string) => {
    let slash = str.indexOf('/', 8) + 1 || str.length;
    let res = encode(str.slice(0, slash).toUpperCase(), false);

    if (slash >= str.length) return res;
    

    let path_res = encode(str.slice(slash), false);
    res.data27 = res.data27.concat(path_res.data27);

    if (res.data10 && path_res.data10) {
        res.data10 = res.data10.concat(path_res.data10);
    }

    if (res.data1 && path_res.data1) {
        res.data1 = res.data1.concat(path_res.data1);
    }

    return res;
}

// {{{1 Choose encode mode and generates struct with data for different version
const encode = (data: string | number | Uint8Array, parse_url: boolean) => {
    let str;
    let t = typeof data;


    if (t == 'string' || t == 'number') {
        str = '' + data;
        data = (new TextEncoder()).encode(str);
    } else if (data instanceof Uint8Array) {
        str = data.toString();
    } else if (Array.isArray(data)) {
        data = (new TextEncoder()).encode(str);
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

    if (data.length > 2953) throw new Error("Too much data");
    return encode_8bit(data);
}

// {{{1 export functions
export default encode;