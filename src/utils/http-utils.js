// HTTP Utility Functions for K6 Performance Tests
// Shared helpers for HTTP requests, form handling, and validation

import http from 'k6/http';
import { check } from 'k6';
import { TestingError } from '../tests/exceptions.js';

/**
 * Extracts the CSRF crumb token from HTML response body
 * @param {string} body - HTML response body
 * @returns {string|null} The crumb value or null if not found
 */
export function extractCrumbFromBody(body) {
  const crumbElement = body.match(/<input[^>]*name=["']crumb["'][^>]*>/i);
  if (!crumbElement) {
    console.warn('✗ Could not find <input name="crumb"> in HTML');
    return null;
  }

  const crumb = crumbElement[0].match(/value=["']([^"']*)["']/i);
  if (!crumb || !crumb[1]) {
    console.warn('✗ Found crumb input but no value attribute');
    return null;
  }

  return crumb[1];
}

/**
 * Generates a random alphanumeric string
 * @param {number} length - Length of string to generate (default: 10)
 * @returns {string} Random uppercase alphanumeric string
 */
export function getRandomString(length = 10) {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

/**
 * Makes an HTTP GET request with validation
 * @param {string} url - URL to request
 * @param {object} checkConditions - K6 check conditions
 * @param {string} errorMessage - Error message if check fails
 * @param {object} options - Additional K6 request options
 * @returns {object} HTTP response
 * @throws {TestingError} If check conditions fail
 */
export function getWithValidation(url, checkConditions, errorMessage, options = {}) {
  const response = http.get(url, options);

  if (!check(response, checkConditions)) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError(errorMessage);
  }

  return response;
}

/**
 * Makes an HTTP POST request with validation
 * @param {string} url - URL to post to
 * @param {object} data - Form data to post
 * @param {object} checkConditions - K6 check conditions
 * @param {string} errorMessage - Error message if check fails
 * @param {object} options - Additional K6 request options
 * @returns {object} HTTP response
 * @throws {TestingError} If check conditions fail
 */
export function postWithValidation(url, data, checkConditions, errorMessage, options = {}) {
  const response = http.post(url, data, options);

  if (!check(response, checkConditions)) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError(errorMessage);
  }

  return response;
}

export function postRestWithValidation(url, data, checkConditions, errorMessage, params = {}) {

  const response = http.post(url, data, params);

  if (!check(response, checkConditions)) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError(errorMessage);
  }

  // Parse JSON response
  const jsonResponse = JSON.parse(response.body);
  if (!jsonResponse.success) {
    throw new TestingError(`Draft save failed: ${jsonResponse.message}`);
  }

  return jsonResponse;
}

/**
 * Extracts crumb from response and throws error if not found
 * @param {object} response - HTTP response object
 * @param {string} context - Context description for error message
 * @returns {string} The extracted crumb value
 * @throws {TestingError} If crumb not found
 */
export function extractCrumbOrThrow(response, context) {
  const crumb = extractCrumbFromBody(response.body);
  if (!crumb) {
    throw new TestingError(`Crumb not found in response body (${context})`);
  }
  return crumb;
}

/**
 * Extracts the CSRF token from meta tag for RESTful endpoints
 * @param {string} body - HTML response body
 * @returns {string|null} The CSRF token or null if not found
 */
export function extractCSRFTokenFromMeta(body) {
  const csrfTokenMatch = body.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
  if (!csrfTokenMatch) {
    console.warn('✗ Could not find <meta name="csrf-token"> in HTML');
    return null;
  }
  return csrfTokenMatch[1];
}
