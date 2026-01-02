import { Request, Response } from 'express';

// Assuming these have TypeScript definitions
const utilities = require('./utilities.js');
const ApiHelper = require('./api-helper.js');
const ApiEndPoint = require('./api-end-points.js');

// Interfaces
interface Session {
  vrToken: string;
  client_ip: string;
  is_public: boolean;
  [key: string]: any;
}
type PickedObject = Record<string, any>;
interface ExtendedRequest extends Request {
  session: Session;
  body: any;
  query: any;
}

interface User {
  status: number;
  user_status?: string;
  region_name?: string;
  locations?: Array<{
    region_name?: string;
    name: string;
  }>;
  organization_name?: string;
  profile?: {
    title: string;
    division: string;
    employee_id: string;
  };
  profile_title?: string;
  profile_division?: string;
  profile_employee_id?: string;
  _permission_on?: string;
  first_name: string;
  last_name: string;
  email_id: string;
  user_role: string;
  signup_datetime: string;
  page_key?: string;
  [key: string]: any;
}

interface UserListResponse {
  status_code: number;
  users: User[];
  page_key?: string;
  [key: string]: any;
}

interface ApiResponse {
  status_code: number;
  [key: string]: any;
}

interface CSVExportResponse {
  status_code: number;
  fields: string[];
  data: any[][];
  csv?: string;
}

interface Utilities {
  [key: string]: any;
}

interface ApiEndPointClass {
  baseUrl: string;
  authenticateappforfiles: string;
  getuserprofiledetailsbyuserid: string;
  v2listusers: string;
  suspenduser: string;
  removeuser: string;
  removeuserinvite: string;
  finduser: string;
  addusers: string;
  setpassword: string;
  savewebpushtoken: string;
  sendtestpushweb: string;
  resendinviteemail: string;
  sendreminderemail: string;
  sendbulkreminderemails: string;
  [key: string]: string;
}

interface RequestParams {
  vrToken?: string;
  [key: string]: any;
}

export class UserListHelper {
  private objutility: Utilities;
  private objApiHelper: any;
  private objApiEndPoint: ApiEndPointClass;
  private query: string;

  constructor() {
    this.objutility = new utilities();
    this.objApiHelper = new ApiHelper();
    this.objApiEndPoint = new ApiEndPoint();
    this.query = "?";
  }

  /**
   * Authenticate app for files
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with authentication response
   */
  authenticateappforfiles(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.authenticateappforfiles;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.GetAsync(apiUrl, loginToken, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Get user profile details by user ID
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with user profile data
   */
  getuserprofiledetailsbyuserid(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const obj = req.query;
    
    // Reset query string
    this.query = "?";
    
    // Build query string
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        this.query += `${key}=${obj[key]}&`;
      }
    }
    
    // Remove trailing '&' if present
    if (this.query.endsWith('&')) {
      this.query = this.query.slice(0, -1);
    }
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.getuserprofiledetailsbyuserid + this.query;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.GetAsync(apiUrl, loginToken, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Export users to CSV with pagination
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with CSV data
   */
  async v2listuserscsv(req: ExtendedRequest, res: Response): Promise<CSVExportResponse> {
    const usersFilter: User[] = [];
    let loadMore = true;
    
    // Paginate through all users
    while (loadMore) {
      try {
        const userList: UserListResponse = await this.v2listusers(req, res);
        
        if (userList.users.length > 0) {
          usersFilter.push(...userList.users);
          
          if (userList.page_key !== undefined) {
            req.body.page_key = userList.page_key;
          } else {
            loadMore = false;
          }
        } else {
          loadMore = false;
        }
      } catch (error) {
        console.error('Error fetching user list:', error);
        loadMore = false;
      }
    }
    
    if (usersFilter.length === 0) {
      return {
        status: 401,
        fields: [],
        data: []
      } as any;
    }
    
    // Process users for CSV export
    const output = usersFilter
      .filter((f: User) => {
        // Map status values
        if (f.status === 2) f.status = 1;
        if (f.status === 0) f.user_status = 'Inactive';
        if (f.status === 1) f.user_status = 'Active';
        
        return f.status === 0 || f.status === 1;
      })
      .map((obj: User) => {
        // Helper function to pick specific properties
        const pick = (ob: any, ...args: string[]) => {
          return args.reduce((res, key) => ({
            ...res,
            [key]: ob[key]
          }), {});
        };
        
        // Process based on filter type
        if (req.body.filter_type === "invite") {
          // Determine permission_on field
          if (obj.region_name) {
            obj._permission_on = obj.region_name;
          } else if (obj.locations && Array.isArray(obj.locations) && obj.locations.length > 0) {
            const regionUser = obj.locations.find(e => e.region_name);
            
            if (regionUser) {
              obj._permission_on = regionUser.region_name;
            } else if (obj.locations.length > 1) {
              obj._permission_on = obj.organization_name;
            } else {
              obj._permission_on = obj.locations[0].name;
            }
          } else {
            obj._permission_on = obj.organization_name;
          }
          
          // Map profile fields
          if (obj.profile) {
            obj.profile_title = obj.profile.title;
            obj.profile_division = obj.profile.division;
            obj.profile_employee_id = obj.profile.employee_id;
          }
          
          // Pick specific fields for invite type
          const pickedObj: Record<string, any> = pick(
            obj,
            'first_name',
            'last_name',
            'email_id',
            '_permission_on',
            'user_role',
            'profile_title',
            'profile_division',
            'profile_employee_id',
            'signup_datetime',
            'user_status'
          );
          
          return Object.keys(pickedObj).map(key => pickedObj[key]);
        } else {
          // Pick specific fields for non-invite type
          const pickedObj: Record<string, any> = pick(
            obj,
            'first_name',
            'last_name',
            'email_id',
            'signup_datetime',
            'user_status'
          );
          
          return Object.keys(pickedObj).map(key => pickedObj[key]);
        }
      });
    
    // Remove duplicates
    const finalOutput = Array.from(
      new Set(output.map(item => JSON.stringify(item)))
    ).map(item => JSON.parse(item));
    
    // Define CSV fields
    let reportFields = ["First Name", "Last Name", "Email", "SignUp Date", "Status"];
    
    if (req.body.filter_type === "invite") {
      reportFields = [
        "First Name",
        "Last Name",
        "Email",
        "Organization/Region/Location",
        "User Role",
        "Title",
        "Division",
        "Employee ID",
        "SignUp Date",
        "Status"
      ];
    }
    
    return {
      status_code: 200,
      fields: reportFields,
      data: finalOutput
    };
    
    // Uncomment to generate actual CSV string
    // const csv = Papa.unparse({
    //   fields: reportFields,
    //   data: finalOutput
    // });
    
    // return {
    //   status_code: 200,
    //   csv: csv
    // };
  }

  /**
   * List users with pagination
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with user list
   */
  v2listusers(req: ExtendedRequest, res: Response): Promise<UserListResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.v2listusers;
    
    return new Promise<UserListResponse>((resolve, reject) => {
      this.objApiHelper.PostAsync(apiUrl, postData, headers, req, res)
        .then((repos: UserListResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Suspend a user
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  suspenduser(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.suspenduser;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PutAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Remove a user
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  removeuser(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.removeuser;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PutAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Remove user invite
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  removeuserinvite(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.removeuserinvite;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PutAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Find user by email
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with user data
   */
  finduser(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.finduser;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PostAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Add users
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  addusers(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.addusers;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PostAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Set user password
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  setpassword(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.setpassword;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PostAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Save web push token
   * @param requestParams - Request parameters including vrToken
   * @returns Promise with operation result
   */
  async savewebpushtoken(requestParams: RequestParams): Promise<ApiResponse | number> {
    const loginToken = requestParams.vrToken || "";
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken
    };
    
    const postData = requestParams;
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.savewebpushtoken;
    
    const response = await this.objApiHelper.post({
      api_url: apiUrl,
      headers: headers,
      request_body: postData
    });
    
    return response;
  }

  /**
   * Send test web push notification
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  sendtestpushweb(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.sendtestpushweb;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.GetAsync(apiUrl, loginToken, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Resend invite email
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  resendinviteemail(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.resendinviteemail;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PostAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Send reminder email
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  sendReminderEmail(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.sendreminderemail;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PostAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  /**
   * Send bulk reminder emails
   * @param req - Express request object
   * @param res - Express response object
   * @returns Promise with operation result
   */
  sendBulkReminderEmails(req: ExtendedRequest, res: Response): Promise<ApiResponse> {
    const loginToken = req.session.vrToken;
    const postData = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginToken,
      'client_ip': req.session.client_ip,
      'is_public': req.session.is_public.toString()
    };
    
    const apiUrl = this.objApiEndPoint.baseUrl + this.objApiEndPoint.sendbulkreminderemails;
    
    return new Promise<ApiResponse>((resolve, reject) => {
      this.objApiHelper.PostAsync(apiUrl, postData, headers, req, res)
        .then((repos: ApiResponse) => {
          resolve(repos);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }
}

// For backward compatibility with CommonJS
export default UserListHelper;