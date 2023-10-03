import { QR as QR_new } from '../lib/qr-base.js';
const qr_old = require('qr-image');


const test_template = (text, ec_level, parse_url) => {
  const result1 = QR_new(text, ec_level, parse_url);
  const result2 = qr_old.matrix(text, ec_level, parse_url);

  expect(result1).toEqual(result2);
}

test('QR function generates the same QR code as qr-image package', () =>
  test_template('Hello, World!', 'H', false));

test('QR function generates the same QR code as qr-image package (with different input)', () => {
  test_template('Testing QR codes', 'L', true);
});

test('QR function generates the same QR code as qr-image package (empty text)', () => {
  test_template('', 'M', false);
});

test('QR function generates the same QR code as qr-image package (special characters)', () => {
  test_template('@#$%^&*()_+-=[]{}|;:,.<>?', 'Q', false);
});

test('QR function generates the same QR code as qr-image package (URL)', () => {
  const url = 'https://www.example.com';
  test_template(url, 'M', true);
});

test('QR function generates the same QR code as qr-image package (Long text)', () => {
  const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam gravida.';
  test_template(longText, 'Q', false);
});

test('Fuzzing-style test: QR function generates the same QR code as qr-image package (Randomized input)', () => {
  const getRandomText = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * 100) + 1; // Random length between 1 and 100
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const numTests = 100;
  for (let i = 0; i < numTests; i++) {
    const text = getRandomText();
    const ec_level = ['L', 'M', 'Q', 'H'][Math.floor(Math.random() * 4)]; // Random EC level
    const parse_url = Math.random() < 0.5; // Random boolean for parse_url

    test_template(text, ec_level, parse_url);
  }
});
