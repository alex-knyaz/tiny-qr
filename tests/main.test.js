import { get_ASCII_image } from '../lib/qr-base.js';


describe('QR function', () => {
  it('should generate a QR code with default error correction level', () => {
    const text = 'Hello, World!';
    const ec_level = 'H';
    const parse_url = false;
    const result = get_ASCII_image(text, ec_level, parse_url);
    const expected =
      `██████████████        ██    ██      ██████████████
██          ██  ████      ██    ██  ██          ██
██  ██████  ██  ████    ██      ██  ██  ██████  ██
██  ██████  ██  ██  ██    ██    ██  ██  ██████  ██
██  ██████  ██  ████    ██████  ██  ██  ██████  ██
██          ██  ████  ██  ████      ██          ██
██████████████  ██  ██  ██  ██  ██  ██████████████
                    ████████                      
    ██    ██████████      ██    ████  ██████████  
████    ██      ██  ████████      ██████  ████  ██
  ████████  ██    ██████  ██████  ████    ████  ██
████                  ██  ██        ████████  ██  
      ██  ████      ████    ██  ██  ████  ██    ██
  ██    ██    ██          ████  ██  ████  ████  ██
██████    ████████  ████        ██        ████  ██
        ██        ██    ██  ██████    ██  ██      
████████  ██████████  ██  ████  ████████████  ██  
                ██    ██    ██  ██      ██████    
██████████████  ████  ██    ██████  ██  ██      ██
██          ██  ██  ████        ██      ██    ██  
██  ██████  ██        ██████  ██████████████      
██  ██████  ██      ████████  ██  ██  ██  ████    
██  ██████  ██  ██████████    ██████    ██████████
██          ██      ██  ████    ████              
██████████████    ██  ██    ████████████████    ██
`;
    expect(result).toEqual(expected);

  });

  it('should generate a QR code with specified error correction level', () => {
    // const text = 'Hello, {name}!';
    // const ec_level = 'L';
    // const parse_url = false;

    // console.log(get_ASCII_image(text, ec_level, parse_url));

    // expect(result).toBeDefined();
  });
});
