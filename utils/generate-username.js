function generateUsername(name, digits = 4) {
    const randomNum = Math.floor(Math.random() * 10**digits)
      .toString()
      .padStart(digits, '0');
    return `@${name.replace(/\s+/g, '').toLowerCase()}${randomNum}`;
    // Example: "@johnsmith0428"
  }

  module.exports = { generateUsername };
