// Helper: Create a testing flow error
export function TestingError(message) {
  this.name = 'TestingError';
  this.message = message || '';
  var error = new Error(this.message);
  error.name = this.name;
  this.stack = error.stack;
}

// Helper: create an authentication error
export function AuthenticationError(message) {
  this.name = 'TestingError';
  this.message = message || '';
  var error = new Error(this.message);
  error.name = this.name;
  this.stack = error.stack;
}
