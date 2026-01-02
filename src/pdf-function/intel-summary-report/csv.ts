import request from 'request';
import moment from 'moment-timezone';

class CSVHelper {
    constructor() { }

    getIntelStatus(intelStatus: number): string | undefined {
        if (intelStatus === 0) {
            return 'Unverified';
        } else if (intelStatus === 1) {
            return 'Verifying';
        } else if (intelStatus === 5) {
            return 'Reported';
        } else if (intelStatus === 7) {
            return 'Assigned';
        } else if (intelStatus === 8) {
            return 'Forwarded';
        } else if (intelStatus === 9) {
            return 'Under Investigation';
        } else if (intelStatus === 10) {
            return 'Closed';
        } else if (intelStatus === 11) {
            return 'Canceled';
        }
        return undefined;
    }

    async generateCsv(req: any): Promise<any[] | string> {
        const parameters = req.body;
        const intelObjects: any[] = [];
        const apiUrl = process.env.API_HOST + '/v2getintelfeeds';
        const clientServerOptions: any = {
            uri: apiUrl,
            body: JSON.stringify(parameters),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                "Authorization": "Bearer " + req.session.vrToken,
                'client_ip': req.session.client_ip,
                'is_public': req.session.is_public
            },
            type: 'application/json',
        };

        const apiResponse = await this.loadDataFromAPI(clientServerOptions);
        const o = JSON.parse(apiResponse);

        if (o.status_code === 200) {
            if (Array.isArray(o.intels) && o.intels.length > 0) {
                for (let i = 0; i < o.intels.length; i++) {
                    // to display incident address in intel summary report 
                    let vrAddress = "";
                    if (
                        o.intels[i].incident_geofence !== "" &&
                        o.intels[i].incident_geofence !== undefined &&
                        o.intels[i].incident_geofence.address !== undefined &&
                        o.intels[i].incident_geofence.address !== ""
                    ) {
                        vrAddress = o.intels[i].incident_geofence.address;
                    } else {
                        vrAddress = "Unknown Address Selected";
                    }

                    // to display claimed in intel summary report
                    let vrClaimed = "";
                    if (o.intels[i].claimed === true) {
                        vrClaimed = o.intels[i].incident_commander.first_name + ' ' + o.intels[i].incident_commander.last_name;
                    } else {
                        vrClaimed = "Not Claimed";
                    }

                    // to display name
                    let vrSubmitterName = "";
                    if (o.intels[i].anonymous === true) {
                        vrSubmitterName = "Anonymous User";
                    } else if (o.intels[i].submitter.first_name && o.intels[i].submitter.last_name) {
                        vrSubmitterName = o.intels[i].submitter.first_name + ' ' + o.intels[i].submitter.last_name;
                    }

                    // to display case id
                    let vrCaseID = "Not Added";
                    if (o.intels[i].case_id !== undefined && o.intels[i].case_id !== null) {
                        vrCaseID = o.intels[i].case_id;
                    }

                    // to display when
                    let vrWhen = "";
                    if (o.intels[i].incident_datetime_type === 1) {
                        vrWhen = "Happening Now";
                    } else if (o.intels[i].incident_datetime_type === 2) {
                        vrWhen = "Has Happened";
                    } else {
                        vrWhen = "Going to Happen";
                    }

                    // to display media
                    let vrMedia = "";
                    if (Array.isArray(o.intels[i].media) && o.intels[i].media.length > 0) {
                        for (let m = 0; m < o.intels[i].media.length; m++) {
                            if (o.intels[i].media[m].type === 1) {
                                vrMedia += ' Photo';
                            } else if (o.intels[i].media[m].type === 2) {
                                vrMedia += ' Video';
                            } else if (o.intels[i].media[m].type === 3) {
                                vrMedia += ' Audio';
                            }
                        }
                    } else {
                        vrMedia = "No";
                    }

                    // to display contact request
                    let vrContactReq = "No";
                    if (o.intels[i].do_not_contact === false) {
                        vrContactReq = "Yes";
                    }

                    // to display submitter location address
                    let vrSubmiterZip = "";
                    if (o.intels[i].submitter_location !== undefined) {
                        if (
                            o.intels[i].submitter_location.address !== undefined &&
                            o.intels[i].submitter_location.address !== null
                        ) {
                            vrSubmiterZip = o.intels[i].submitter_location.address;
                        }
                    }

                    // to display mark received 
                    let vrMarkReceived = "";
                    if (o.intels[i].mark_recieved === true) {
                        vrMarkReceived = moment(o.intels[i].mark_recieved_datetime, 'X')
                            .tz("America/New_York")
                            .format('YYYY-MM-DD HH:mm:ss');
                    }

                    // to display archived
                    let vrArchived = "Open";
                    if (o.intels[i].archived === true) {
                        vrArchived = "Archived";
                    }

                    // map category to text
                    if (o.intels[i].category === 1) {
                        o.intels[i].category = "Tip";
                    }
                    if (o.intels[i].category === 2) {
                        o.intels[i].category = "Non-Emergency";
                    }
                    if (o.intels[i].category === 3) {
                        o.intels[i].category = "Emergency";
                    }
                    if (o.intels[i].category === 4) {
                        o.intels[i].category = "Live Video";
                    }
                    if (o.intels[i].category === 5) {
                        o.intels[i].category = "BOLO Tip";
                    }
                    if (o.intels[i].category === 6) {
                        o.intels[i].category = "SMS Intel";
                    }
                    if (o.intels[i].category === 7) {
                        o.intels[i].category = "Staff Assist";
                    }
                    if (o.intels[i].category === 8) {
                        o.intels[i].category = "Incident";
                    }
                    if (o.intels[i].category === 9) {
                        o.intels[i].category = "SaferWalk Alarm";
                    }
                    if (o.intels[i].category === 12) {
                        o.intels[i].category = "ALPR";
                    }
                    if (o.intels[i].category === 13) {
                        o.intels[i].category = "Access Control";
                    }

                    // intel method 
                    let intelMethod = 'SaferWatch Mobile Panic Button';
                    if (o.intels[i].raptor_method !== undefined) {
                        intelMethod = `RAPTOR Panic Alert - ${o.intels[i].raptor_method}`;
                    } else if (o.intels[i].centegix_method !== undefined) {
                        intelMethod = `Centegix Panic Alert - ${o.intels[i].centegix_method}`;
                    } else if (o.intels[i].audioenhancement_sub_location !== undefined) {
                        intelMethod = `Audio Enhancement Panic Alert`;
                    } else if (o.intels[i].method === 'FourDScape') {
                        intelMethod = `FourDScape Panic Alert`;
                    } else if (o.intels[i].is_desktop === true) {
                        intelMethod = 'SaferWatch Desktop Panic Button';
                    } else if (o.intels[i].wearable_button_type !== undefined) {
                        intelMethod = `SaferWatch Wearable Panic Button${(o.intels[i].wearable_button_type === 1) ? ' - RED' : (o.intels[i].wearable_button_type === 2 ? ' - BLUE' : '')}`;
                    } else if (
                        o.intels[i].flick_action !== undefined &&
                        o.intels[i].flick_action !== null &&
                        o.intels[i].flick_action !== ""
                    ) {
                        if (o.intels[i].button_type === "mobilehelp") {
                            intelMethod = 'SaferWatch LTE Panic Button';
                        } else {
                            intelMethod = 'SaferWatch Physical Panic Button';
                        }
                        if (o.intels[i].flick_action === 1) {
                            intelMethod += ' - Five Clicks';
                        } else if (o.intels[i].flick_action === 2) {
                            intelMethod += ' - Hold Down';
                        } else if (o.intels[i].flick_action === 3) {
                            intelMethod += ' - Three Clicks';
                        } else if (o.intels[i].flick_action === 4) {
                            intelMethod += ' - One Click';
                        }
                    } else if (o.intels[i].created_from && o.intels[i].created_from === 'public') {
                        intelMethod = 'SaferWatch Web Form';
                    }

                    const t = moment.utc(o.intels[i].create_datetime)
                        .tz("America/New_York")
                        .format('YYYY-MM-DD HH:mm:ss');

                    const iObj: any = {
                        "Intel Type": o.intels[i].category,
                        "SaferWatch Report ID": o.intels[i].report_id,
                        "Case #": vrCaseID,
                        "Submitted Date": t,
                        "Incident Type": (o.intels[i].incident && o.intels[i].incident.title) || "",
                        "When": vrWhen,
                        "Location Submitted To": o.intels[i].location_name,
                        "Incident Address Reported": vrAddress,
                        "Media Files Submitted": vrMedia,
                        "Submitter Name": vrSubmitterName,
                        "Contact Requested": vrContactReq,
                        //"Submitted Location Zip": getZipFromAddress(vrSubmiterZip), // removed column as per SV-1635
                        "Marked Received": vrMarkReceived,
                        "Claimed": vrClaimed,
                        "Tip Status": this.getIntelStatus(o.intels[i].status),
                        "Archived": vrArchived,
                        "Method": intelMethod,
                        "Alert Description": o.intels[i].alert_description
                        // "Cancel Reason": cancelReason,
                    };

                    if (req.session.isSuperAdmin === true) {
                        iObj["Organization Submitted To"] = o.intels[i].organization_name;
                    }

                    intelObjects.push(iObj);
                }
                return intelObjects;
            } else {
                return intelObjects;
            }
        } else {
            console.error("API returned: " + o.status_code);
            return "Some error encountered while generating PDF, please contact Administrator.";
        }
    }

    loadDataFromAPI(options: any): Promise<string> {
        const clientServerOptions = options;
        return new Promise((resolve, reject) => {
            request(clientServerOptions, function (err: any, _rq: any, rs: any) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rs);
                }
            });
        });
    }
}

export default CSVHelper;


