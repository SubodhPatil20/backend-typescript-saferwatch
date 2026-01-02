// Ambient module declarations for packages without bundled TypeScript types
declare module "html-pdf";
declare module "node-html-parser";
declare module "request";

// Helper module declarations
declare module "../../helper/api-helper.js" {
    class ApiHelper {
        constructor();
        GetAsync(ApiUrl: string, token: string, req: any, res: any, key?: string): Promise<any>;
        PostAsync(ApiUrl: string, token: string, req: any, res: any, body?: any, key?: string): Promise<any>;
        PutAsync(ApiUrl: string, token: string, req: any, res: any, body?: any): Promise<any>;
        DeleteAsync(ApiUrl: string, token: string, req: any, res: any): Promise<any>;
    }
    export = ApiHelper;
}

declare module "../../helper/user-list-helper.js" {
    class UserListHelper {
        constructor();
        authenticateappforfiles(req: any, res: any): Promise<any>;
        getuserprofiledetailsbyuserid(req: any, res: any): Promise<any>;
        [key: string]: any;
    }
    export = UserListHelper;
}





