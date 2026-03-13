/**
 * Read from stdin if available (i.e., data is piped in).
 * Returns empty string when stdin is a TTY or on error.
 */
export async function readStdinIfAvailable(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', () => {
      resolve('');
    });
  });
}
