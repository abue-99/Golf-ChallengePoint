import { HttpStatus } from '@nestjs/common';
import {
  InvalidCredentialsException,
  InvalidTokenException,
  InsufficientRoleException,
} from './auth.exception';

describe('Auth Exceptions', () => {
  describe('InvalidCredentialsException', () => {
    it('should have HTTP 401 status', () => {
      const exception = new InvalidCredentialsException();
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should have correct response body', () => {
      const exception = new InvalidCredentialsException();
      const response = exception.getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(response.message).toBe('Invalid credentials');
    });
  });

  describe('InvalidTokenException', () => {
    it('should have HTTP 401 status', () => {
      const exception = new InvalidTokenException();
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should have correct response body', () => {
      const exception = new InvalidTokenException();
      const response = exception.getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(response.message).toBe('Invalid or expired token');
    });
  });

  describe('InsufficientRoleException', () => {
    it('should have HTTP 403 status', () => {
      const exception = new InsufficientRoleException();
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    });

    it('should have correct response body', () => {
      const exception = new InsufficientRoleException();
      const response = exception.getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(response.message).toBe(
        'You do not have the required role to access this resource',
      );
    });
  });
});
