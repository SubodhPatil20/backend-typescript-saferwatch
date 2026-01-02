/**
 * @class ApiHelper
 * @constructor 
 * @author 
 * @version 1.0
 * @description Contains all Standard CRUD functions with caching support
 */

import * as request from 'request';
import { Request, Response } from 'express';

// Assuming these have TypeScript definitions or we'll define them
const ApiEndPoint = require('./api-end-points.js');
const SessionExpired = require('./sessionExpired');
const config = require('../config/config.js');
let cacheProvider = require('./cache-provider');

const CACHE_DURATION = 600;

// Interfaces
interface Session {
  client_ip: string;
  is_public: boolean;
  [key: string]: any;
}

interface ExtendedRequest extends Request {
  session: Session;
}

interface RequestParams {
  api_url: string;
  request_body: any;
  headers: Record<string, string>;
}

interface ClientServerOptions {
  url?: string;
  uri?: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  type?: string;
  json?: boolean;
}

interface ApiResponse {
  status_code: number;
  success?: boolean;
  status?: boolean;
  message?: string;
  fromCache?: boolean;
  [key: string]: any;
}

interface CacheProvider {
  instance(): {
    get(key: string, callback: (err: any, value: any) => void): void;
    set(key: string, value: any, duration: number, callback: (err: any, success: boolean) => void): void;
  };
}

interface Config {
  checkUserValidity(statusCode: number, req: ExtendedRequest, res: Response): void;
}

interface ApiEndPointClass {
  baseUrl: string;
  [key: string]: any;
}

export class ApiHelper {
  private objApiEndPoint: ApiEndPointClass;
  private objSessionExpired: any;
  private objConfig: Config;
  private cacheProvider: CacheProvider;

  constructor() {
    this.objApiEndPoint = new ApiEndPoint();
    this.objSessionExpired = new SessionExpired();
    this.objConfig = new config();
    this.cacheProvider = cacheProvider;
  }

  /**
   * Perform a GET request with optional caching
   * @param ApiUrl - The API endpoint URL
   * @param token - Authentication token
   * @param req - Express request object
   * @param res - Express response object
   * @param key - Cache key (optional)
   * @returns Promise with the API response
   */
  GetAsync(
    ApiUrl: string, 
    token: string, 
    req: ExtendedRequest, 
    res: Response, 
    key?: string
  ): Promise<ApiResponse> {
    const cacheKey = key || '';
    
    const clientServerOptions: ClientServerOptions = {
      url: ApiUrl,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'app_version': process.env.PORTAL_VERSION || '',
        'client_ip': req.session.client_ip,
        'is_public': req.session.is_public.toString()
      }
    };

    return new Promise<ApiResponse>((resolve, reject) => {
      if (cacheKey && cacheKey.trim() !== '') {
        this.cacheProvider.instance().get(cacheKey, (err: any, value: any) => {
          if (value) {
            try {
              const cachedResponse: ApiResponse = JSON.parse(value);
              cachedResponse.fromCache = true;
              resolve(cachedResponse);
            } catch (parseError) {
              console.error('Error parsing cached value:', parseError);
              // Fall through to API call if cache parsing fails
              this.makeGetRequest(clientServerOptions, req, res, cacheKey, resolve, reject);
            }
          } else {
            this.makeGetRequest(clientServerOptions, req, res, cacheKey, resolve, reject);
          }
        });
      } else {
        this.makeDirectGetRequest(clientServerOptions, req, res, resolve, reject);
      }
    });
  }

  /**
   * Make GET request with caching support
   */
  private makeGetRequest(
    options: ClientServerOptions,
    req: ExtendedRequest,
    res: Response,
    cacheKey: string,
    resolve: (value: ApiResponse) => void,
    reject: (reason?: any) => void
  ): void {
    request(options, (err: any, response: any, body: any) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const apiResponse: ApiResponse = typeof body === 'string' ? JSON.parse(body) : body;
        
        if (apiResponse.status_code === 200) {
          // Cache the successful response
          this.cacheProvider.instance().set(
            cacheKey, 
            JSON.stringify(apiResponse), 
            CACHE_DURATION, 
            (cacheErr: any, success: boolean) => {
              if (cacheErr) {
                console.error('Cache set error:', cacheErr);
              }
            }
          );
          
          apiResponse.fromCache = false;
          resolve(apiResponse);
        } else {
          reject(apiResponse.status_code);
        }
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        reject('Invalid API response format');
      }
    });
  }

  /**
   * Make GET request without caching
   */
  private makeDirectGetRequest(
    options: ClientServerOptions,
    req: ExtendedRequest,
    res: Response,
    resolve: (value: ApiResponse) => void,
    reject: (reason?: any) => void
  ): void {
    this.GetAsyncReturn(options, req, res)
      .then((result: ApiResponse) => {
        if (result.status_code === 200) {
          resolve(result);
        } else {
          reject(result.status_code);
        }
      })
      .catch((error: any) => {
        reject(error);
      });
  }

  /**
   * Execute a GET request and return the response
   */
  private GetAsyncReturn(
    clientServerOptions: ClientServerOptions, 
    req: ExtendedRequest, 
    res: Response
  ): Promise<ApiResponse> {
    return new Promise<ApiResponse>((resolve, reject) => {
      request(clientServerOptions, (err: any, response: any, body: any) => {
        try {
          if (err) {
            reject(err);
            return;
          }

          if (body !== undefined) {
            const apiResponse: ApiResponse = typeof body === 'string' ? JSON.parse(body) : body;
            resolve(apiResponse);
          } else {
            reject(new Error('Empty response from server'));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError}`));
        }
      });
    });
  }

  /**
   * Perform a POST request
   */
  async post(requestParams: RequestParams): Promise<ApiResponse | number> {
    const { api_url, request_body, headers } = requestParams;
    
    headers.app_version = process.env.PORTAL_VERSION || '';
    
    const clientServerOptions: ClientServerOptions = {
      uri: api_url,
      body: JSON.stringify(request_body),
      method: 'POST',
      headers: headers,
      type: 'application/json',
    };

    try {
      const result: ApiResponse = await this.PostAsyncReturn(clientServerOptions, null, null);
      
      if (result.status_code === 200) {
        return result;
      } else {
        return result.status_code;
      }
    } catch (error) {
      console.error('POST request error:', error);
      return error as any;
    }
  }

  /**
   * Execute a POST request and return the response
   */
  private PostAsyncReturn(
    clientServerOptions: ClientServerOptions, 
    req: ExtendedRequest | null, 
    res: Response | null
  ): Promise<ApiResponse> {
    return new Promise<ApiResponse>((resolve, reject) => {
      try {
        request(clientServerOptions, (err: any, response: any, body: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (body !== undefined) {
            try {
              const apiResponse: ApiResponse = typeof body === 'string' ? JSON.parse(body) : body;
              resolve(apiResponse);
            } catch (parseError) {
              reject(new Error(`Failed to parse response: ${parseError}`));
            }
          } else {
            reject(new Error('Empty response from server'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Perform a POST request with custom headers
   */
  PostAsync(
    ApiUrl: string, 
    requestParams: any, 
    headers: Record<string, string>
  ): Promise<ApiResponse> {
    headers.app_version = process.env.PORTAL_VERSION || '';
    
    const clientServerOptions: ClientServerOptions = {
      uri: ApiUrl,
      body: JSON.stringify(requestParams),
      method: 'POST',
      headers: headers,
      type: 'application/json',
    };

    return new Promise<ApiResponse>((resolve, reject) => {
      request(clientServerOptions, (err: any, response: any, body: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (body !== undefined) {
          try {
            const apiResponse: ApiResponse = typeof body === 'string' ? JSON.parse(body) : body;
            
            if (apiResponse.status_code === 200) {
              resolve(apiResponse);
            } else {
              reject(apiResponse.status_code);
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError}`));
          }
        } else {
          reject(new Error('Empty response from server'));
        }
      });
    });
  }

  /**
   * Perform a PUT request
   */
  PutAsync(
    ApiUrl: string, 
    requestParams: any, 
    headers: Record<string, string>, 
    req: ExtendedRequest, 
    res: Response
  ): Promise<ApiResponse> {
    headers.app_version = process.env.PORTAL_VERSION || '';
    
    const clientServerOptions: ClientServerOptions = {
      uri: ApiUrl,
      body: JSON.stringify(requestParams),
      method: 'PUT',
      headers: headers
    };

    return new Promise<ApiResponse>((resolve, reject) => {
      this.PutAsyncReturn(clientServerOptions, req, res)
        .then((result: ApiResponse) => {
          if (result.status_code === 200) {
            resolve(result);
          } else {
            reject(result.status_code);
          }
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Execute a PUT request and return the response
   */
  private PutAsyncReturn(
    clientServerOptions: ClientServerOptions, 
    req: ExtendedRequest, 
    res: Response
  ): Promise<ApiResponse> {
    return new Promise<ApiResponse>((resolve, reject) => {
      try {
        request(clientServerOptions, (err: any, response: any, body: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (body !== undefined) {
            try {
              const apiResponse: ApiResponse = typeof body === 'string' ? JSON.parse(body) : body;
              resolve(apiResponse);
            } catch (parseError) {
              reject(new Error(`Failed to parse response: ${parseError}`));
            }
          } else {
            reject(new Error('Empty response from server'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Perform a DELETE request
   */
  DeleteAsync(
    ApiUrl: string, 
    requestParams: any, 
    headers: Record<string, string>, 
    req: ExtendedRequest, 
    res: Response
  ): Promise<ApiResponse> {
    headers.app_version = process.env.PORTAL_VERSION || '';
    
    const clientServerOptions: ClientServerOptions = {
      uri: ApiUrl,
      body: JSON.stringify(requestParams),
      method: 'DELETE',
      headers: headers
    };

    return new Promise<ApiResponse>((resolve, reject) => {
      this.DeleteAsyncReturn(clientServerOptions, req, res)
        .then((result: ApiResponse) => {
          if (result.status_code === 200) {
            resolve(result);
          } else {
            reject(result.status_code);
          }
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Execute a DELETE request and return the response
   */
  private DeleteAsyncReturn(
    clientServerOptions: ClientServerOptions, 
    req: ExtendedRequest, 
    res: Response
  ): Promise<ApiResponse> {
    return new Promise<ApiResponse>((resolve, reject) => {
      try {
        request(clientServerOptions, (err: any, response: any, body: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (body !== undefined) {
            try {
              const apiResponse: ApiResponse = typeof body === 'string' ? JSON.parse(body) : body;
              resolve(apiResponse);
            } catch (parseError) {
              reject(new Error(`Failed to parse response: ${parseError}`));
            }
          } else {
            reject(new Error('Empty response from server'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Perform a raw POST request
   */
  RawPost(
    clientServerOptions: ClientServerOptions, 
    req: ExtendedRequest, 
    res: Response
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      try {
        request(clientServerOptions, (err: any, response: any, body: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(body);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Perform a GET request for Eldercare with caching
   */
  GetAsyncEldercare(
    apiUrl: string, 
    token: string, 
    req: ExtendedRequest, 
    key?: string | number
  ): Promise<ApiResponse> {
    const cacheKey = (key && (typeof key === 'string' || typeof key === 'number')) 
      ? key.toString() 
      : '';
    
    if (key && !cacheKey) {
      console.warn('Invalid cache key, disabling cache:', key);
    }

    return new Promise<ApiResponse>((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token,
      };

      const options: ClientServerOptions = {
        url: apiUrl,
        method: 'GET',
        headers,
        json: true
      };

      if (cacheKey) {
        this.cacheProvider.instance().get(cacheKey, (err: any, cachedValue: any) => {
          if (cachedValue) {
            try {
              const parsed: ApiResponse = typeof cachedValue === 'string' 
                ? JSON.parse(cachedValue) 
                : cachedValue;
              parsed.fromCache = true;
              return resolve(parsed);
            } catch (parseErr) {
              console.error('Cache parse error:', parseErr);
              // Continue with API call if cache parsing fails
            }
          }

          this.makeEldercareRequest(options, cacheKey, resolve, reject);
        });
      } else {
        this.makeEldercareRequest(options, '', resolve, reject);
      }
    });
  }

  /**
   * Make Eldercare API request
   */
  private makeEldercareRequest(
    options: ClientServerOptions,
    cacheKey: string,
    resolve: (value: ApiResponse) => void,
    reject: (reason?: any) => void
  ): void {
    request(options, (error: any, response: any, body: ApiResponse) => {
      if (error) {
        console.error('Request error:', error);
        reject(`API request failed: ${error.message}`);
        return;
      }

      if (response.statusCode >= 400) {
        reject(`HTTP error: ${response.statusCode}`);
        return;
      }

      if (body?.success === true || body?.status === true) {
        if (cacheKey) {
          try {
            const toCache = typeof body === 'string' ? body : JSON.stringify(body);
            this.cacheProvider.instance().set(
              cacheKey, 
              toCache, 
              CACHE_DURATION, 
              (err: any) => {
                if (err) console.error('Cache set error:', err);
              }
            );
          } catch (cacheErr) {
            console.error('Cache stringify error:', cacheErr);
          }
        }

        body.fromCache = false;
        resolve(body);
      } else {
        reject(body?.message || 'API returned unsuccessful response');
      }
    });
  }

  /**
   * Perform a POST request for Eldercare
   */
  EldercarePostAsync(
    ApiUrl: string, 
    requestParams: any, 
    headers: Record<string, string>
  ): Promise<ApiResponse> {
    headers.app_version = process.env.PORTAL_VERSION || '';
    
    const clientServerOptions: ClientServerOptions = {
      uri: ApiUrl,
      body: JSON.stringify(requestParams),
      method: 'POST',
      headers: headers,
      type: 'application/json',
    };

    return new Promise<ApiResponse>((resolve, reject) => {
      request(clientServerOptions, (err: any, response: any, body: any) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          if (body) {
            const apiResponse: ApiResponse = typeof body === 'string' ? JSON.parse(body) : body;
            
            if (apiResponse.success === true) {
              resolve(apiResponse);
            } else {
              reject(apiResponse);
            }
          } else {
            reject({ error: "Empty response" });
          }
        } catch (e) {
          reject({ error: "Invalid JSON response", details: e });
        }
      });
    });
  }
}

// For backward compatibility with CommonJS
export default ApiHelper;