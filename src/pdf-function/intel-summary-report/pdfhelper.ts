import request from 'request';
import { parse as parseHtml } from 'node-html-parser';
import moment from 'moment-timezone';
const statusMatrix: { [key: number]: string } = {
    0: "Unverified",
    1: "Verifying",
    // 2: "Verified",
    // 3: "Unable to Confirm",
    // 4: "False",
    5: "Reported",
    // 6: "Resolved",
    7: "Assigned",
    8: "Forwarded",
    9: "Under Investigation",
    10: "Closed"
};

class PDFHelper {
    private isAnonymousChat: boolean = false;

    constructor() { }

    statusValue(val: number): string {
        switch (val) {
            case 0: // forward intel
                return "Unverified";
            case 1: // change status
                return "Verifying";
            case 7: // claim incident
                return "Assigned";
            case 8: // mark received
                return "Forwarded";
            case 5: // archive intel
                return "Reported";
            case 9: // 0:create/1:udpate/2:delete caseid
                return "Under Investigation";
            case 10:
                return "Closed";
            default: // made a comment/image/video/doc
                return "";
        }
    }

    getEmergencyStatus(intelStatus: number, intelStatusText: string = 'Other', category: number = 3): string | undefined {
        if (intelStatus === 0) {
            return 'All Clear';
        } else if (intelStatus === 1) {
            if (category === 7) {
                return 'Staff Assist Has Been Resolved';
            } else {
                return 'Emergency Has Been Resolved';
            }
        } else if (intelStatus === 2) {
            return 'Evacuate';
        } else if (intelStatus === 3) {
            return 'First Responders Are On Scene';
        } else if (intelStatus === 4) {
            return 'First Responders Are On The Way';
        } else if (intelStatus === 5) {
            return 'Help Is On The Way';
        } else if (intelStatus === 6) {
            return 'Please Call 911 If Possible';
        } else if (intelStatus === 7) {
            return 'Provide Additional Details If Possible';
        } else if (intelStatus === 8) {
            return 'Report Received';
        } else if (intelStatus === 9) {
            return 'Reported';
        } else if (intelStatus === 10) {
            return 'Shelter In Place';
        } else if (intelStatus === 11) {
            return 'Trying To Locate You Now';
        } else if (intelStatus === 12) {
            return intelStatusText;
        } else if (intelStatus === 13) {
            return 'Provide Exact Location of Incident';
        }

        return undefined;
    }

    async generatePdf(req: any): Promise<string> {
        // region user check
        if (
            (req.session.isLocationAdmin != undefined && req.session.isLocationAdmin === true) &&
            (req.session.locationDropdown != undefined && Array.isArray(req.session.locationDropdown) && req.session.locationDropdown.length > 0)
        ) {
            const regionData = req.session.locationDropdown.find((e: any) => e.region_id != undefined);
            if (regionData != undefined && regionData !== '' && regionData.region_name != undefined && regionData.region_name !== '') {
                req.body.is_region_user_for_sms_chat = true;
            }
        }

        const parameters = req.body;
        const apiUrl = process.env.API_HOST + '/getintelcases';
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
            if (Array.isArray(o.cases)) {
                const caseNotesHtml = await this.createHtmlOfPdf(parameters, o.cases, req);
                return caseNotesHtml;
            } else {
                return "Some error encountered while generating PDF, please contact Administrator.";
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

    async createHtmlOfPdf(parameters: any, icases: any[], req: any): Promise<string> {
        //#region Anonymous Report Check
        try {
            const isAnonymousChatPromise = new Promise<boolean>((resolve) => {
                const selectedOrg = req.session.orgrDropdown.find((e: any) => e.id === parameters.organization_id);
                if (selectedOrg) {
                    resolve(selectedOrg.addons.sms_tip_anonymous || false);
                } else {
                    resolve(false);
                }
            });
            this.isAnonymousChat = await isAnonymousChatPromise;
        } catch (_error) {
            this.isAnonymousChat = false;
        }
        //#endregion

        let cases: any[] = [];
        const groups: { [date: string]: any[] } = {};

        for (let z = icases.length - 1; z > -1; z--) {
            let isExistCaseDataForReport = true;

            if (req.session != undefined &&
                req.session.isLocationAdmin != undefined &&
                req.session.isLocationAdmin === true &&
                parameters != undefined &&
                parameters.locationids != undefined &&
                icases[z].location_id != undefined &&
                !parameters.locationids.includes(icases[z].location_id)) {
                isExistCaseDataForReport = false;
            }

            if (isExistCaseDataForReport) {
                let report_text = '';
                report_text += '<a href="#"> Report ID: ' + icases[z].report_id + '</a> - ';
                if (icases[z].submitter.first_name != undefined) {
                    report_text += icases[z].submitter.first_name + ' ';
                }
                if (icases[z].submitter.last_name != undefined) {
                    report_text += icases[z].submitter.last_name + ' ';
                }

                // set action
                if (icases[z].action_type != undefined && icases[z].action_type === 0) {
                    if (icases[z].media_type != undefined && icases[z].media_type >= 0) {
                        report_text += '<b>Uploaded Media Files</b>';
                        if (icases[z].comment_text != undefined && icases[z].comment_text !== "" && icases[z].comment_text != null) {
                            report_text += ' and ';
                        }
                    }
                    //multiple media in casenotes
                    if (icases[z].media != undefined && icases[z].media.length !== 0) {
                        report_text += '<b>Uploaded Media Files</b>';
                        if (icases[z].comment_text != undefined && icases[z].comment_text !== "" && icases[z].comment_text != null) {
                            report_text += ' and ';
                        }
                    }
                    if (icases[z].comment_text != undefined && icases[z].comment_text !== "" && icases[z].comment_text != null) {
                        report_text += '<b>Commented: ' + icases[z].comment_text + ' </b>';
                    }
                } else if (icases[z].action_type != undefined && icases[z].action_type === 1) {
                    report_text += '<b>';
                    report_text += 'Forwarded Intel to';
                    if (icases[z].agency != undefined && icases[z].agency != null && icases[z].agency !== "") {
                        report_text += icases[z].agency + ' : ';
                    }
                    if (icases[z].emails != undefined && icases[z].emails != null && Array.isArray(icases[z].emails) && icases[z].emails.length > 0) {
                        report_text += icases[z].emails.join(", ");
                    }
                    report_text += '</b>';
                } else if (icases[z].action_type != undefined && icases[z].action_type === 2) {
                    report_text += '<b>Changed Status from ' + statusMatrix[icases[z].from_status] + ' to ' + statusMatrix[icases[z].to_status] + '</b>';
                } else if (icases[z].action_type != undefined && icases[z].action_type === 3) {
                    if (icases[z].category != undefined && icases[z].category === 3) {
                        report_text += '<b>Claimed Emergency Report</b>';
                    } else {
                        report_text += '<b>Claimed Intel</b>';
                    }
                } else if (icases[z].action_type != undefined && icases[z].action_type === 4) {
                    report_text += '<b>Marked Received</b>';
                } else if (icases[z].action_type != undefined && icases[z].action_type === 5) {
                    report_text += '<b>Archived Intel</b>';
                } else if (icases[z].action_type != undefined && icases[z].action_type === 6) {
                    if (icases[z].action_value != undefined && icases[z].action_value === 2) {
                        report_text += '<b>';
                        report_text += 'Deleted Case ID';
                        report_text += '</b>';
                    } else if (icases[z].action_value != undefined && icases[z].action_value === 1) {
                        report_text += '<b>';
                        report_text += 'Updated Case ID';
                        if (icases[z].case_id != undefined && icases[z].case_id != null && icases[z].case_id !== "") {
                            report_text += ': ' + icases[z].case_id;
                        }
                        report_text += '</b>';
                    } else {
                        report_text += '<b>';
                        report_text += 'Added Case ID';
                        if (icases[z].case_id != undefined && icases[z].case_id != null && icases[z].case_id !== "") {
                            report_text += ': ' + icases[z].case_id;
                        }
                        report_text += '</b>';
                    }
                } else if (icases[z].action_type != undefined && icases[z].action_type === 7) {
                    report_text += '<b>Changed Incident Type from ' + ((icases[z].from_incident != undefined && icases[z].from_incident.title != undefined) ? icases[z].from_incident.title : "") + ' to ' + ((icases[z].to_incident != undefined && icases[z].to_incident.title != undefined) ? icases[z].to_incident.title : "") + '</b>';
                } else if (icases[z].action_type != undefined && icases[z].action_type === 8) {
                    report_text += '<b>Changed Location from ' + ((icases[z].from_location != undefined && icases[z].from_location.name != undefined) ? icases[z].from_location.name : "") + ' to ' + ((icases[z].to_location != undefined && icases[z].to_location.name != undefined) ? icases[z].to_location.name : "") + '</b>';
                } else if (icases[z].action_type != undefined && icases[z].action_type === 10) {
                    report_text += '<b> Canceled Emergency Report </b>';
                } else if (icases[z].action_type != undefined && icases[z].action_type === 11) {
                    report_text += `Reporter's Status Changed from <b>${this.getEmergencyStatus(icases[z].from_status, icases[z].from_reporter_status_text, icases[z].category)}</b> to <b>${this.getEmergencyStatus(icases[z].to_status, icases[z].to_reporter_status_text, icases[z].category)}</b>`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 12) {
                    report_text += `Reason for cancellation: <b>${icases[z].comment_text}</b>`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 13) {
                    report_text += `Ended Live Video`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 14) {
                    report_text += `Activated Live Video at ${moment.utc(icases[z].created_datetime).local().format('hh:mm:ss A')} on ${moment.utc(icases[z].created_datetime).local().format('MM/DD/YY')}`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 15) {
                    report_text += `Ended Live Video`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 16) {
                    report_text += `Reason for Ending Live Video: <b>${icases[z].comment_text}</b>`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 17) {
                    report_text += `Joined video Session As The Operator`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 18) {
                    report_text += `Joined video Session As A Viewer`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 19) {
                    report_text += `Configured Reported Address`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 20) {
                    report_text += `Caller: ${(this.isAnonymousChat === true) ? parseInt(icases[z].from_number).toString(16) : icases[z].from_number} clicked on Live Video Link to initiate emergency Live Video session`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 21) {
                    report_text += `<b>Live Video Ended</b>`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 22) {
                    if (icases[z].live_video != undefined && icases[z].live_video.live_video_report_id != undefined) {
                        report_text += `<b>Texted a LIVE Video url to ${(this.isAnonymousChat === true) ? parseInt(icases[z].from_number).toString(16) : icases[z].from_number}</b>`;
                    } else if (icases[z].media_upload != undefined && icases[z].media_upload.media_upload_report_id != undefined) {
                        report_text += `<b>Sent the Media Upload URL to ${(this.isAnonymousChat === true) ? parseInt(icases[z].from_number).toString(16) : icases[z].from_number}</b>`;
                    } else if (icases[z].location_sharing != undefined && icases[z].location_sharing.location_sharing_report_id != undefined) {
                        report_text += `<b>Sent the Location Sharing URL to ${(this.isAnonymousChat === true) ? parseInt(icases[z].from_number).toString(16) : icases[z].from_number}</b>`;
                    }
                } else if (icases[z].action_type != undefined && icases[z].action_type === 23) {
                    report_text += ``;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 24) {
                    report_text += `Live video stream was interrupted`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 25) {
                    report_text += `Live video stream was resumed`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 26) {
                    report_text += `Live video stream was paused`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 27) {
                    report_text += `Live video stream was ended because of inactivity`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 28) {
                    report_text += `Ended Conversation`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 29) {
                    report_text += `Caller: ${(this.isAnonymousChat === true) ? parseInt(icases[z].from_number).toString(16) : icases[z].from_number} initiated emergency Live Video session`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 30) {
                    report_text += `Chat has closed automatically due to timeout`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 31) {
                    report_text += `Started a SMS conversation with reporter: ${(this.isAnonymousChat === true) ? parseInt(icases[z].from_number).toString(16) : icases[z].from_number}`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 32) {
                    report_text += `Ended Sharing Location: ${icases[z].submitter_location.address}`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 33) {
                    report_text += `Updated Location: ${icases[z].submitter_location.address}`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 34) {
                    report_text += `Started Sharing Location: ${icases[z].submitter_location.address}`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 35) {
                    report_text += `Shared the live video url: ${icases[z].viewers.phone_numbers.join(', ')} ${icases[z].viewers.email_ids.join(', ')} ${icases[z].viewers.groups.map((e: any) => e.name).join(', ')}`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 38) {
                    report_text += `Initiated Phone Call to SaferWatch LTE Panic Button`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 39) {
                    report_text += `SaferWatch LTE Panic Button Call Recording:`;
                    report_text += '<ul>';
                    let fileNo = 1;
                    for (let n = 0; n < icases[z].media.length; n++) {
                        report_text += `<li style="font-size: 13px;"><label style="color:#808080;">File ${fileNo}:</label> <a target="_blank" href="${process.env.MEDIA_HOST + icases[z].media[n].media_key}">${process.env.MEDIA_HOST + icases[z].media[n].media_key}</a></li>`;
                        fileNo++;
                    }
                    report_text += '</ul>';
                } else if (icases[z].action_type != undefined && icases[z].action_type === 50) {
                    report_text += `LP${" " + icases[z].lp || "N/A"} was detected from Camera ${icases[z].camera_id || "N/A"}`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 52) {
                    report_text += `Initiated Phone Call to ${icases[z]?.psap?.agency || "PSAP"}${icases[z]?.psap?.phone ? ` at ${icases[z]?.psap?.phone}` : ''}`;
                } else if (icases[z].action_type != undefined && icases[z].action_type === 53) {
                    report_text += `${(icases[z].psap && icases[z].psap.agency) ? icases[z].psap.agency : 'PSAP'} Call Recording${(icases[z].psap && icases[z].psap.phone) ? ` at ${icases[z]?.psap?.phone}` : ''}:`;
                    report_text += '<ul>';
                    let fileNo = 1;
                    for (let n = 0; n < icases[z].media.length; n++) {
                        report_text += `<li style="font-size: 13px;"><label style="color:#808080;">File ${fileNo}:</label> <a target="_blank" href="${process.env.MEDIA_HOST + icases[z].media[n].media_key}">${process.env.MEDIA_HOST + icases[z].media[n].media_key}</a></li>`;
                        fileNo++;
                    }
                    report_text += '</ul>';
                } else {
                    if (icases[z].comment_text != undefined) {
                        report_text += '<b>' + parseHtml(icases[z].comment_text) + '</b>';
                    }
                }

                if (!icases[z].incident_title && icases[z].category === 4) {
                    report_text += ' on ';
                    report_text += 'ONGOING LIVE VIDEO';
                } else if (icases[z].incident_title) {
                    report_text += ' on ';
                    report_text += icases[z].incident_title;
                }

                if (icases[z].category === 3) {
                    report_text += ' Emergency submitted to ';
                } else if (icases[z].category === 2) {
                    report_text += ' Non-Emergency submitted to ';
                } else if (icases[z].category === 1) {
                    report_text += ' Tip submitted to ';
                } else if (icases[z].category === 9) {
                    report_text += ' SaferWalk submitted to ';
                } else if (icases[z].category === 4) {
                    report_text += ' Live Video submitted to ';
                } else if (icases[z].category === 12) {
                    report_text += 'ALPR submitted to ';
                } else if (icases[z].category === 13) {
                    report_text += 'Access Control submitted to ';
                }

                report_text += icases[z].location_name;
                report_text += ' <br>';
                icases[z].report_text = report_text;

                const momentString = moment(icases[z].intel_case_id, 'X');
                icases[z].date = momentString.tz('America/New_York').format('MM/DD/YYYY');
                icases[z].time = momentString.tz('America/New_York').format('LTS') + " EST";

                // create group for dates
                if (groups[icases[z].date] === undefined) {
                    groups[icases[z].date] = [];
                }
                groups[icases[z].date].push(icases[z]);
            }
        }

        let caseHtml = "<div style='padding:5px; margin-top:5px;'";
        caseHtml += '<div style="display:none;"><img style="width:200px;margin-top:-5px;display:none;" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAcAAADzCAYAAAD6iH9eAAAACXBIWXMAAC4jAAAuIwF4pT92AAAFGmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDggNzkuMTY0MDM2LCAyMDE5LzA4LzEzLTAxOjA2OjU3ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjEuMCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjAtMDgtMDRUMTc6NDU6MTUrMDU6MzAiIHhtcDpNb2RpZnlEYXRlPSIyMDIxLTA2LTE0VDExOjQ0OjI4KzA1OjMwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIxLTA2LTE0VDExOjQ0OjI4KzA1OjMwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjNjZDYyY2E3LThlNjEt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" alt="saferwatch-logo" /></div>';
        caseHtml += '<div style="text-align:center;font-size:19px;"><label> <b>' + parameters.selectedOrg + ' - Intel Activity Report <br />' + parameters.startDate + ' - ' + parameters.endDate + '</b></label></div><hr>';
        cases = [];

        for (const groupName in groups) {
            cases.push({
                date: groupName,
                value: groups[groupName]
            });
        }

        cases.sort(function (a, b) {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        const dateArray: { date: string; value: any[] }[] = [];

        let currentDate = moment(req.body.from_date, 'X');
        const stopDate = moment((req.body.to_date), 'X');
        while (currentDate <= stopDate) {
            dateArray.push({
                date: currentDate.format('MM/DD/YYYY'),
                value: []
            });
            currentDate = currentDate.add(1, 'days');
        }

        for (let d = 0; d < dateArray.length; d++) {
            for (let c = 0; c < cases.length; c++) {
                if (new Date(cases[c].date).getTime() === new Date(dateArray[d].date).getTime()) {
                    dateArray[d].value = cases[c].value;
                }
            }
        }
        cases = dateArray;

        for (let j = cases.length - 1; j >= 0; j--) {
            caseHtml += '<div style="margin-top:4%;margin-bottom:0%;font-weight:bold;font-size:14px">' + cases[j].date + ' </div></br>';
            cases[j].value.sort((a: any, b: any) => (a.time > b.time) ? -1 : ((a.time < b.time) ? 1 : 0));
            for (let o = 0; o < cases[j].value.length; o++) {
                caseHtml += '<div style="font-size:14px;"><i>' + cases[j].value[o].time + '</i> - ' + cases[j].value[o].report_text + '</div></br>';
            }
            caseHtml += '<hr>';
        }
        caseHtml += '</div>';
        return caseHtml;
    }
}

export default PDFHelper;


