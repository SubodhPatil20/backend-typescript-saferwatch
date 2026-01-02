const fs = require('fs');
const pdf = require('html-pdf');
const request = require('request').defaults({ encoding: null });
const path = require('path');
const moment = require('moment-timezone')
const ApiHelper = require('../../helper/api-helper.js');
const UserListHelper = require('../../helper/user-list-helper.js');
const datetimeFormat = "YY-MM-DD hh:mm:ss"
const datetimeCapital = "hh:mm:ss A"
const datetimeSmall = "hh:mm:ss a"
const dateSimpleFormat = "MM/DD/YY"
const datetimeSmallWithoutSec = "hh:mm a"

exports.intelFullReport = (authToken, intelId, disableContactPreference, req, res) => {
    // API Params
    var apiUrl = process.env.API_HOST + '/getalertdetails?intel_id=' + intelId;
    var clientServerOptions = {
        uri: apiUrl,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            "Authorization": "Bearer " + authToken,
            'client_ip': req.session.client_ip,
            'is_public': req.session.is_public
        }
    }
    // API Call
    return new Promise(function (resl, rejt) {
        request(clientServerOptions, async function (apierr, apires) {
            if (apierr) {
                rejt(apierr)
            } else {
                var responseBody = apires.body;
                if (responseBody != undefined && responseBody != null) {
                    var intelData = JSON.parse(responseBody);
                    if (intelData.status_code == 200) {
                        if(intelData.category==3 || intelData.category==7){     
                            var includeMedia=includeCaseNotes=1                                                  
                            return intelEmergencyReport(authToken, intelId, includeMedia, disableContactPreference, includeCaseNotes, intelData, req, res, resl,true).then(y=>resl(y)).catch(e=>rejt(e));
                        }else{

                            //#region Anonymous Report Check
                            try {
                                const isAnonymousChatPromise = new Promise((resolve, reject) => {
                                    var selectedOrg = req.session.orgrDropdown.find(e => e.id === intelData.organization_id)
                                    if (selectedOrg) {
                                        resolve(selectedOrg.addons.sms_tip_anonymous || false)
                                    } else {
                                        resolve(false)
                                    }
                                })
                                this.isAnonymousChat = await isAnonymousChatPromise;   
                            } catch (error) {
                                this.isAnonymousChat = false;
                            }
                            //#endregion
                            //#region html template
                            var html = fs.readFileSync(path.join(__dirname, 'intel-report.html'), 'utf8');
                            var options = {
                                format: 'Letter',
                                timeout: 300000,
                                childProcessOptions: { 
                                    env: { 
                                        OPENSSL_CONF: '/dev/null' 
                                    } 
                                }
                            };
                            var currentDate = moment().tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
                            if(req.session!=undefined && req.session.isLocationAdmin!=undefined && req.session.isLocationAdmin && req.session.locationDropdown!=undefined && req.session.locationDropdown[0].region_name!=undefined && req.session.locationDropdown[0].region_name!=''){
                                html = html.replace("{organization_name}", req.session.locationDropdown[0].region_name || "N/A");
                            }else{  
                                html = html.replace("{organization_name}", intelData.organization_name || "N/A");
                            }
                            if(intelId!=undefined && intelId!=''){
                                var apiUrl = process.env.API_HOST + '/getintelcases?intel_id=' + intelId;
                                const reqBody = {intel_id:intelId, pagesize: 500};
                                // region user check
                                if(
                                    (req.session.isLocationAdmin != undefined && req.session.isLocationAdmin == true) && 
                                    (req.session.locationDropdown != undefined && Array.isArray(req.session.locationDropdown) && req.session.locationDropdown.length > 0)
                                ){
                                    regionData = req.session.locationDropdown.find(e => e.region_id != undefined);
                                    if(regionData != undefined && regionData != '' && regionData.region_name != undefined && regionData.region_name != ''){
                                        reqBody.is_region_user_for_sms_chat = true;
                                    }
                                }
                                const casesOptions = {
                                    uri: apiUrl,
                                    method: "POST",
                                    body: JSON.stringify(reqBody),
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": "Bearer " + authToken,
                                        'client_ip': req.session.client_ip,
                                        'is_public': req.session.is_public
                                    }
                                }
                                var caseNotesHtmlIn = await new Promise( function (resl, rejt) {
                                    request(casesOptions, function (apierr, apires) {
                                        var responseBody = apires.body;
                                        if (responseBody != undefined && responseBody != null) {
                                            caseNotesData = JSON.parse(responseBody);
                                            var caseNotesHtml='';
                                            caseNotesHtml+='<tr><td><div style="page-break-before: always; width:auto;height:auto;max-width:100%;"><label style="font-size: 15px;"><u>CASE NOTES </u></label><br>';
                                    
                                            if(caseNotesData!=undefined && caseNotesData.cases.length>0){
                                                for(var incr=0; caseNotesData.cases.length>incr; incr++){
                                                    //[MM/DD/YY] @ [HH:MM:SS] 
                                                    //[FirstName] [LastName]: [CaseNoteAction & Updated Value] 
                                                    var dateShow = '';
                                                    //dateShow = moment(caseNotesData.cases[incr].created_datetime).tz('America/New_York').format('MM/DD/YY @ hh:mm:ss');
                                                    dateShow = moment.utc(caseNotesData.cases[incr].created_datetime).tz('America/New_York').format('MM/DD/YYYY @ LTS')+" EST";
                                                    caseNotesHtml+='<br><div style="font-size: 13px;">'+dateShow+'</div>';                                                
                                                    if(caseNotesData.cases[incr].comment_text!=undefined && caseNotesData.cases[incr].comment_text!=''){
                                                        caseNotesHtml+='<div style="font-size: 13px;">';
                                                        if(caseNotesData.cases[incr].submitter.first_name!=undefined && caseNotesData.cases[incr].submitter.first_name!=''){
                                                            caseNotesHtml+=caseNotesData.cases[incr].submitter.first_name;
                                                        }
                                                        if(caseNotesData.cases[incr].submitter.last_name!=undefined && caseNotesData.cases[incr].submitter.last_name!=''){
                                                            caseNotesHtml+=' '+caseNotesData.cases[incr].submitter.last_name;
                                                        }
                                                        caseNotesHtml+=': '+ caseNotesData.cases[incr].comment_text+'</div>';
                                                    }else{
                                                        caseNotesHtml+='<div style="font-size: 13px;">'+getCaseNotesHtml(caseNotesData.cases[incr])+'</div>';
                                                    }
                                                }
                                                caseNotesHtml+='</div></td></tr>';
                                                //caseNotesHtml+='</table></td></tr></table>';
                                                resl(caseNotesHtml)
                                            }else{
                                                caseNotesHtml+='<tr><td><div><label style="font-size: 15px;"><b>N/A</b></label></div></td></tr>';                                       
                                                resl(caseNotesHtml)
                                            }
                                        }else{
                                            html = html.replace("{case_notes}", ""); 
                                            rejt();
                                        }
                                    })
                                }).catch(err => {
                                    console.error(err);
                                    //html = html.replace("{case_notes}", "");
                                })
                                if(caseNotesHtmlIn!=undefined){
                                    html = html.replace("{case_notes}", caseNotesHtmlIn);
                                }else{
                                    html = html.replace("{case_notes}", ""); 
                                }
                            }else{
                                html = html.replace("{case_notes}", "");
                            }

                            
                            if(req.session!=undefined && req.session.isLocationAdmin!=undefined && req.session.isLocationAdmin && req.session.locationDropdown!=undefined && req.session.locationDropdown[0].region_name!=undefined && req.session.locationDropdown[0].region_name!=''){                                
                                if(req.session.locationDropdown[0].region_logo!=undefined && req.session.locationDropdown[0].region_logo!=''){
                                    var imageFile = process.env.MEDIA_HOST +  req.session.locationDropdown[0].region_logo;
                                    html = html.replace("{organization_logo}", '<img src="' + imageFile + '" alt="' + req.session.locationDropdown[0].region_name + '" width="100" height="100">');
                                }else{
                                    html = html.replace("{organization_logo}", '');
                                }                               
                            }else{    
                                if (intelData.organization_logo != "" && intelData.organization_logo != undefined) {
                                    var imageFile = process.env.MEDIA_HOST + intelData.organization_logo;
                                    var imgData = await new Promise((res, rej) => {
                                        request.get(imageFile, function (error, response, body) {
                                            if (!error && response.statusCode == 200) {
                                                data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                                res(data)
                                            } else {
                                                res(imageFile)
                                            }
                                        });
                                    })
                                    html = html.replace("{organization_logo}", '<img src="' + imgData + '" alt="' + intelData.organization_name + '" width="100" height="100">');
                                } else {
                                    html = html.replace("{organization_logo}", "");
                                }
                            }

                            if (intelData.category == 5) {
                                html = html.replace("{location_name}", intelData.organization_name || "N/A");
                            } else {
                                html = html.replace("{location_name}", intelData.location_name);
                            }

                            if (intelData.location_logo != "" && intelData.location_logo != undefined) {
                                var imageFile = process.env.MEDIA_HOST + intelData.location_logo;
                                var imgData = await new Promise((res, rej) => {
                                    request.get(imageFile, function (error, response, body) {
                                        if (!error && response.statusCode == 200) {
                                            data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                            res(data)
                                        } else {
                                            res(imageFile)
                                        }
                                    });
                                })
                                html = html.replace("{location_logo}", '<img src="' + imgData + '" alt="' + intelData.location_name + '" width="100" height="100">');
                            } else {
                                html = html.replace("{location_logo}", "");
                            }
                            var exportedBy = "";
                            if (intelData.report_exported_by != undefined && intelData.report_exported_by.first_name) {
                                exportedBy = intelData.report_exported_by.first_name;
                                if (intelData.report_exported_by.last_name != undefined) {
                                    exportedBy += " " + intelData.report_exported_by.last_name;
                                }
                            }
                            html = html.replace("{exported_by}", exportedBy || "N/A");
                            html = html.replace("{generated_on}", currentDate || "N/A");
                            // html = html.replace("{numberofpages}", "N/A");
                            html = html.replace("{report_id}", intelData.report_id || "N/A");
                            html = html.replace("{report_id}", intelData.report_id || "N/A");
                            html = html.replace("{case_id}", intelData.case_id || "N/A");
                            html = html.replace("{case_id}", intelData.case_id || "N/A");
                            html = html.replace("{submitter_first_name}", intelData.submitter.first_name || "Anonymous");
                            html = html.replace("{submitter_last_name}", intelData.submitter.last_name || "");
                            if (intelData.anonymous == true) {
                                html = html.replace("{incident_reported_by}", "Anonymous");
                            } else {
                                var submitterName = "User";
                                if (intelData.submitter.first_name != undefined && intelData.submitter.first_name != "") {
                                    submitterName = intelData.submitter.first_name;
                                    if (intelData.submitter.last_name != undefined && intelData.submitter.last_name != "") {
                                        submitterName += " " + intelData.submitter.last_name;
                                    }
                                }
                                html = html.replace("{incident_reported_by}", submitterName || "N/A");
                            }
                            html = html.replace("{report_id_footer}", intelData.report_id || "N/A");
                            html = html.replace("{case_id_footer}", intelData.case_id || "N/A");
                            switch (intelData.category) {
                                case 1:
                                    html = html.replace("{report_type}", "Tip");
                                    break;
                                case 2:
                                    html = html.replace("{report_type}", "Non-Emergency");
                                    break;
                                case 3:
                                    html = html.replace("{report_type}", "Emergency");
                                    break;
                                case 4:
                                    html = html.replace("{report_type}", "Live Video");
                                    break;
                                case 5:
                                    html = html.replace("{report_type}", "BOLO Tip");
                                    break;
                                case 6:
                                    html = html.replace("{report_type}", "SMS Intel");
                                    break;
                                case 7:
                                    html = html.replace("{report_type}", "Staff Assist");
                                    break;
                                case 8:
                                    html = html.replace("{report_type}", "Incident");
                                    break;
                                case 9:
                                    html = html.replace("{report_type}", "SaferWalk Alarm");
                                    break; 
                                case 12:
                                    html = html.replace("{report_type}", "APLR");
                                    break; 
                            }
                            // incident_type
                            if (intelData.category == 5) {
                                html = html.replace("{incident_type}", intelData.alert_data.alert_type.title + " Alert" || "N/A");
                            } else {
                                html = html.replace("{incident_type}", intelData.incident.title || "N/A");
                            }
                            if (intelData.category == 5) {
                                html = html.replace("{location_name}", intelData.organization_name || "N/A");
                            } else {
                                html = html.replace("{location_name}", intelData.location_name || "N/A");
                            }
                            if (intelData.anonymous == true) {
                                html = html.replace("{image_url}", "Anonymous");
                            } else if (intelData.submitter.google_profile_image != undefined && intelData.submitter.google_profile_image != null && intelData.submitter.google_profile_image != "" && intelData.submitter.google_id != undefined && intelData.submitter.google_id != null && intelData.submitter.google_id != "") {
                                var imageFile = intelData.submitter.google_profile_image;
                                var imgData = await new Promise((res, rej) => {
                                    request.get(imageFile, function (error, response, body) {
                                        if (!error && response.statusCode == 200) {
                                            data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                            res(data)
                                        } else {
                                            res(imageFile)
                                        }
                                    });
                                })
                                html = html.replace("{image_url}", '<img src="' + imgData + '" alt="ProfileImage" width="100" height="100" />');
                            } else if (intelData.submitter.fb_profile_image != undefined && intelData.submitter.fb_profile_image != null && intelData.submitter.fb_profile_image != "" && intelData.submitter.fb_id != undefined && intelData.submitter.fb_id != null && intelData.submitter.fb_id != "") {
                                var imageFile = intelData.submitter.fb_profile_image;
                                var imgData = await new Promise((res, rej) => {
                                    request.get(imageFile, function (error, response, body) {
                                        if (!error && response.statusCode == 200) {
                                            data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                            res(data)
                                        } else {
                                            res(imageFile)
                                        }
                                    });
                                })
                                html = html.replace("{image_url}", '<img src="' + imgData + '" alt="ProfileImage" width="100" height="100" />');
                            } else if (intelData.submitter.image_key != undefined && intelData.submitter.image_key != null && intelData.submitter.image_key != "") {
                                var imageFile = process.env.MEDIA_HOST + intelData.submitter.image_key;
                                var imgData = await new Promise((res, rej) => {
                                    request.get(imageFile, function (error, response, body) {
                                        if (!error && response.statusCode == 200) {
                                            data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                            res(data)
                                        } else {
                                            res(imageFile)
                                        }
                                    });
                                })
                                html = html.replace("{image_url}", '<img src="' + imgData + '" alt="ProfileImage" width="100" height="100" />');
                            } else {
                                html = html.replace("{image_url}", "N/A");
                            }
                            if (intelData.anonymous == true) {
                                html = html.replace("{submitter_name}", "Anonymous");
                            } else {
                                var submitterName = "User";
                                if (intelData.submitter.first_name != undefined && intelData.submitter.first_name != "") {
                                    submitterName = intelData.submitter.first_name;
                                    if (intelData.submitter.last_name != undefined && intelData.submitter.last_name != "") {
                                        submitterName += " " + intelData.submitter.last_name;
                                    }
                                }
                                html = html.replace("{submitter_name}", submitterName || "N/A");
                            }
                            var intelDate = moment(intelData.create_datetime, 'X').tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
                            html = html.replace("{submitter_on}", intelDate || "N/A");
                            html = html.replace("{submitter_location}", intelData.submitter_location.address || "N/A");
                            html = html.replace("{gpscoordinates}", intelData.submitter_location.latitude + "," + intelData.submitter_location.longitude || "N/A");
                            html = html.replace("{submitter_ipaddress}", intelData.submitter.ip_address || "N/A");
                            if (intelData.anonymous == true) {
                                html = html.replace("{submitter_phone}", "Anonymous");
                            } else if (intelData.do_not_contact == true) {
                                html = html.replace("{submitter_phone}", "Requested Not to be Contacted");
                            } else {

                                var cleaned = ('' + intelData.submitter.phone_number).replace(/\D/g, '')
                                var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
                                if (match) {
                                    var intlCode = (match[1] ? '+1 ' : '')
                                    intelData.submitter.phone_number = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
                                }


                                html = html.replace("{submitter_phone}", intelData.submitter.country_code + "- " + intelData.submitter.phone_number || "N/A");
                            }
                            if (intelData.anonymous == true) {
                                html = html.replace("{submitter_email}", "Anonymous");
                            } else if (intelData.do_not_contact == true) {
                                html = html.replace("{submitter_email}", "Requested Not to be Contacted");
                            } else {
                                html = html.replace("{submitter_email}", intelData.submitter.email_id || "N/A");
                            }
                            html = html.replace("{carrier_name}", intelData.submitter.carrier_name || "N/A");
                            html = html.replace("{device_type}", intelData.submitter.device_type || "N/A");
                            html = html.replace("{device_os}", intelData.submitter.device_os || "N/A");
                            html = html.replace("{device_id}", intelData.submitter.device_id || "N/A");
                            html = html.replace("{device_id}", intelData.submitter.device_id || "N/A");
                            html = html.replace("{device_model}", intelData.submitter.device_model || "N/A");
                            var incidentLocation = "N/A";
                            if (intelData.incident_geofence != undefined && intelData.incident_geofence.address != undefined && intelData.incident_geofence.address != "") {
                                incidentLocation = intelData.incident_geofence.address || "";
                                incidentLocation = ((intelData.incident_geofence.radius != undefined && intelData.incident_geofence.radius != 0) ? intelData.incident_geofence.radius + " ft from " : "") + incidentLocation;
                                incidentLocation = incidentLocation.toString()//.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                            } else {
                                incidentLocation = "Unknown Address Selected";
                            }
                            html = html.replace("{incident_location}", incidentLocation);
                            html = html.replace("{incident_description}", intelData.alert_description || "N/A");
                            var incidentDate = "N/A";
                            var inDTime = "";
                            switch (intelData.incident_datetime_type) {
                                case 1:
                                case "1":
                                    incidentDate = "Happening Now ";
                                    inDTime = moment(intelData.create_datetime, 'X').tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
                                    break;
                                case 2:
                                case "2":
                                    incidentDate = "Has Happened ";
                                    if (intelData.incident_datetime != undefined && intelData.incident_datetime != "") {
                                        inDTime = moment(intelData.incident_datetime).format('MM-DD-YYYY LTS')+" EST"
                                    }
                                    break;
                                case 3:
                                case "3":
                                    incidentDate = "Going to Happen ";
                                    if (intelData.incident_datetime != undefined && intelData.incident_datetime != "") {
                                        inDTime = moment(intelData.incident_datetime).format('MM-DD-YYYY LTS')+" EST"
                                    }
                                    break;
                            }
                            incidentDate += inDTime;
                            html = html.replace("{incident_datetime}", incidentDate);
                            html = html.replace("{timeline_description}", intelData.timeline_description || "")

                            //#region intel media
                            var intelMedia = "";
                            if (!Array.isArray(intelData.media)) {
                                intelData.media = [];
                            }
                            intelMedia += '<ul>';
                            // images

                            var intelImages = intelData.media.filter(e => {
                                return e.type == 1;
                            })

                            if (intelImages != undefined && intelImages.length > 0) {
                                intelMedia += '<li>' + intelImages.length + ' Image(s)</br>';
                                for (const el of intelImages) {
                                    var imageFile = process.env.MEDIA_HOST + el.s3key;
                                    var imgData = await new Promise((res, rej) => {
                                        request.get(imageFile, function (error, response, body) {
                                            if (!error && response.statusCode == 200) {
                                                data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                                res(data)
                                            } else {
                                                res(imageFile)
                                            }
                                        });
                                    })
                                    intelMedia += '<div style="page-break-before: always; page-break-after: always; width:auto;height:auto;max-width:100%;max-height:580px; text-align: center; margin-left: -40px;"><a href="' + imageFile + '" target="_blank" style="width:auto;height:auto;max-width:100%;max-height:580px;"><img src="' + imgData + '" style="width:auto;height:auto;max-width:100%;max-height:580px;"></a></div>';
                                }
                                intelMedia += '</li>'
                            } else {
                                intelMedia += '<li>0 Image(s)</li>';
                            }
                            // videos
                            var intelVideos = intelData.media.filter(e => {
                                return e.type == 2;
                            });
                            if (intelVideos != undefined && intelVideos.length > 0) {
                                intelMedia += '<li>' + intelVideos.length + ' Video File(s)<ul>';
                                intelVideos.forEach(el => {
                                    intelMedia += '<li><a href="' + process.env.MEDIA_HOST + el.s3key + '" target="_blank">' + el.s3key + '</a></li>';
                                })
                                intelMedia += '</ul></li>';
                            } else {
                                intelMedia += '<li>0 Video File(s)</li>';
                            }
                            // audios
                            var intelAudios = intelData.media.filter(e => {
                                return e.type == 3;
                            });
                            if (intelAudios != undefined && intelAudios.length > 0) {
                                intelMedia += '<li>' + intelAudios.length + ' Audio File(s)<ul>';
                                intelAudios.forEach(el => {
                                    intelMedia += '<li><a href="' + process.env.MEDIA_HOST + el.s3key + '" target="_blank">' + el.s3key + '</a></li>';
                                })
                                intelMedia += '</ul></li>';
                            } else {
                                intelMedia += '<li>0 Audio File(s)</li>';
                            }
                            intelMedia += '</ul>';
                            if (intelImages == undefined && intelVideos == undefined && intelAudios == undefined) {
                                intelMedia = "<br />No Media Files Submitted";
                            }
                            html = html.replace("{media}", intelMedia);
                            //#endregion

                            // individual description
                            var individualInfo = "";
                            if (Array.isArray(intelData.individuals_info) && intelData.individuals_info.length > 0) {
                                for (let loopIndex = 0; loopIndex < intelData.individuals_info.length; loopIndex++) {
                                    const individualPersonInfo = intelData.individuals_info[loopIndex].person_info;

                                    individualInfo += '<tr><td style="padding-top:20px; color:#000;"><label class="indivisualIdHeading" style="font-size: 15px;"><u>INDIVIDUAL DESCRIPTION #' + (loopIndex + 1) + '</u></label><ul>';
                                    if (individualPersonInfo.gender != undefined && individualPersonInfo.gender != "") {
                                        if (individualPersonInfo.gender == 1) {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> Male</li>';
                                        } else if (individualPersonInfo.gender == 2) {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> Female</li>';
                                        } else {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> N/A</li>';
                                        }
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.ethnicity_id != undefined && individualPersonInfo.ethnicity_id != "") {
                                        individualInfo += ' <li style="font-size:13px;"><label style="color:#808080;">Ethnicity:</label> ' + individualPersonInfo.ethnicity_id + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Ethnicity:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.age != undefined && individualPersonInfo.age != "") {
                                        if (individualPersonInfo.age.age != undefined && individualPersonInfo.age.age != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> ' + individualPersonInfo.age.age + 'yrs</li>';
                                        } else if (individualPersonInfo.age.range_start != undefined && individualPersonInfo.age.range_start != "" && individualPersonInfo.age.range_end != undefined && individualPersonInfo.age.range_end != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> ' + individualPersonInfo.age.range_start + '-' + individualPersonInfo.age.range_end + ' yrs</li>';
                                        } else {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> N/A</li>';
                                        }
                                    }
                                    var hairs = '';
                                    if (individualPersonInfo.hair_color_id != undefined && individualPersonInfo.hair_color_id != "") {
                                        hairs += '<li style="font-size:13px;"> <label style="color:#808080;">Hair Color:</label> ' + individualPersonInfo.hair_color_id + ' {hair_type} </li>';
                                        if (individualPersonInfo.hair_type_id != undefined) {
                                            hairs = hairs.replace('{hair_type}', '<label style="color:#808080;">Hair Type: </label> ' + individualPersonInfo.hair_type_id || "N/A");
                                        } else {
                                            hairs = hairs.replace('{hair_type}', '<label style="color:#808080;">Hair Type:</label> N/A');
                                        }
                                    }
                                    individualInfo += hairs;
                                    if (individualPersonInfo.height != undefined) {
                                        if (individualPersonInfo.height.height != undefined && individualPersonInfo.height.height != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> ' + individualPersonInfo.height.height + 'ft</li>';
                                        } else if (individualPersonInfo.height.range_start != undefined && individualPersonInfo.height.range_start != "" && individualPersonInfo.height.range_end != undefined && individualPersonInfo.height.range_end != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> ' + individualPersonInfo.height.range_start + '-' + individualPersonInfo.height.range_end + ' ft</li>';
                                        } else {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> N/A</li>';
                                        }
                                    }
                                    if (individualPersonInfo.weight != undefined && individualPersonInfo.weight != "") {
                                        if (individualPersonInfo.weight.weight != undefined && individualPersonInfo.weight.weight != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> ' + individualPersonInfo.weight.weight + ' Lbs</li>';
                                        } else if (individualPersonInfo.weight.range_start != undefined && individualPersonInfo.weight.range_start != "" && individualPersonInfo.weight.range_end != undefined && individualPersonInfo.weight.range_end != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> ' + individualPersonInfo.weight.range_start + '-' + individualPersonInfo.weight.range_end + ' Lbs</li>';
                                        } else {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> N/A</li>';
                                        }
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.name != undefined && individualPersonInfo.name != '') {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Name:</label> ' + individualPersonInfo.name + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Name:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.nickname != undefined && individualPersonInfo.nickname != '') {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Nickname:</label> ' + individualPersonInfo.nickname + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Nickname:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.eye_color_id != undefined && individualPersonInfo.eye_color_id != '') {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Eye Color:</label> ' + individualPersonInfo.eye_color_id + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Eye Color:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.facial_hair_id != undefined && individualPersonInfo.facial_hair_id != '') {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Facial Hair:</label> ' + individualPersonInfo.facial_hair_id + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Facial Hair:</label> N/A</li>';
                                    }

                                    var hats = '<li style="font-size:13px;"> <label style="color:#808080;">Hat Color:</label> {hat_color_id} <label style="color:#808080;">Hat Type:</label> {hat_id}';
                                    if (individualPersonInfo.hat_color_id != undefined && individualPersonInfo.hat_color_id != '') {
                                        hats = hats.replace('{hat_color_id}', individualPersonInfo.hat_color_id);
                                    } else {
                                        hats = hats.replace('{hat_color_id}', "N/A");
                                    }
                                    if (individualPersonInfo.hat_id != undefined && individualPersonInfo.hat_id != '') {
                                        hats = hats.replace('{hat_id}', individualPersonInfo.hat_id);
                                    } else {
                                        hats = hats.replace('{hat_id}', "N/A");
                                    }
                                    individualInfo += hats;

                                    var shirts = '<li style="font-size:13px;"> <label style="color:#808080;">Shirt Color:</label> {shirt_color_id} <label style="color:#808080;">Shirt Type:</label> {shirt_type_id} </li>';
                                    if (individualPersonInfo.shirt_color_id != undefined && individualPersonInfo.shirt_color_id != "") {
                                        shirts = shirts.replace('{shirt_color_id}', individualPersonInfo.shirt_color_id);
                                    } else {
                                        shirts = shirts.replace('{shirt_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.shirt_type_id != undefined && individualPersonInfo.shirt_type_id != '') {
                                        shirts = shirts.replace('{shirt_type_id}', individualPersonInfo.shirt_type_id);
                                    } else {
                                        shirts = shirts.replace('{shirt_type_id}', "N/A");
                                    }
                                    individualInfo += shirts;

                                    var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Pant Color:</label> {pants_color_id} <label style="color:#808080;">Pant Type:</label> {pants_type_id} </li>';
                                    if (individualPersonInfo.pants_color_id != undefined && individualPersonInfo.pants_color_id != "") {
                                        obj = obj.replace('{pants_color_id}', individualPersonInfo.pants_color_id);
                                    } else {
                                        obj = obj.replace('{pants_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.pants_type_id != undefined && individualPersonInfo.pants_type_id != '') {
                                        obj = obj.replace('{pants_type_id}', individualPersonInfo.pants_type_id);
                                    } else {
                                        obj = obj.replace('{pants_type_id}', "N/A");
                                    }
                                    individualInfo += obj;

                                    var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Dress Color:</label> {dress_color_id} <label style="color:#808080;">Dress Type:</label> {dress_type_id} </li>';
                                    if (individualPersonInfo.dress_color_id != undefined && individualPersonInfo.dress_color_id != "") {
                                        obj = obj.replace('{dress_color_id}', individualPersonInfo.dress_color_id);
                                    } else {
                                        obj = obj.replace('{dress_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.dress_type_id != undefined && individualPersonInfo.dress_type_id != '') {
                                        obj = obj.replace('{dress_type_id}', individualPersonInfo.dress_type_id);
                                    } else {
                                        obj = obj.replace('{dress_type_id}', "N/A");
                                    }
                                    individualInfo += obj;

                                    var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Outwear Color:</label> {outerwear_color_id} <label style="color:#808080;">Outwear Type:</label> {outerwear_type_id} </li>';
                                    if (individualPersonInfo.outerwear_color_id != undefined && individualPersonInfo.outerwear_color_id != "") {
                                        obj = obj.replace('{outerwear_color_id}', individualPersonInfo.outerwear_color_id);
                                    } else {
                                        obj = obj.replace('{outerwear_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.outerwear_type_id != undefined && individualPersonInfo.outerwear_type_id != '') {
                                        obj = obj.replace('{outerwear_type_id}', individualPersonInfo.outerwear_type_id);
                                    } else {
                                        obj = obj.replace('{outerwear_type_id}', "N/A");
                                    }
                                    individualInfo += obj;

                                    var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Shoe Color:</label> {shoe_color_id} <label style="color:#808080;">Shoe Type:</label> {shoe_type_id} </li>';
                                    if (individualPersonInfo.shoe_color_id != undefined && individualPersonInfo.shoe_color_id != "") {
                                        obj = obj.replace('{shoe_color_id}', individualPersonInfo.shoe_color_id);
                                    } else {
                                        obj = obj.replace('{shoe_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.shoe_type_id != undefined && individualPersonInfo.shoe_type_id != '') {
                                        obj = obj.replace('{shoe_type_id}', individualPersonInfo.shoe_type_id);
                                    } else {
                                        obj = obj.replace('{shoe_type_id}', "N/A");
                                    }
                                    individualInfo += obj;

                                    individualInfo += '</ul> </td> </tr>';
                                }
                            }
                            html = html.replace('{individualInfo}', individualInfo);
                            if (intelData.additional_information != undefined) {

                                if ((intelData.additional_information.name == undefined || intelData.additional_information.name == null || intelData.additional_information.name == "") && (intelData.additional_information.phone_number == undefined || intelData.additional_information.phone_number == null || intelData.additional_information.phone_number == "") && (intelData.additional_information.email == undefined || intelData.additional_information.email == null || intelData.additional_information.email == "") && (intelData.additional_information.relationship_title == undefined || intelData.additional_information.relationship_title == null || intelData.additional_information.relationship_title == "") && (intelData.additional_information.address == undefined || intelData.additional_information.address == null || intelData.additional_information.address == "")) {
                                    html = html.replace('{person_with_more_information}', "");


                                    html = html.replace('{additional_information_name}', "");
                                    html = html.replace('{additional_information_phone_number}', "");
                                    html = html.replace('{additional_information_email}', "");
                                    html = html.replace('{additional_information_relation}', "");

                                    if (intelData.additional_information.address != undefined && typeof intelData.additional_information.address == "string" && intelData.additional_information.address.length > 0) {
                                        html = html.replace('{additional_information_address}', "");
                                    } else if (intelData.additional_information.address != undefined && intelData.additional_information.address.address != undefined && typeof intelData.additional_information.address.address == "string" && intelData.additional_information.address.address.length > 0) {
                                        html = html.replace('{additional_information_address}', "");
                                    } else {
                                        html = html.replace('{additional_information_address}', "");
                                    }
                                    html = html.replace('{name}', "");
                                    html = html.replace('{phone}', "");
                                    html = html.replace('{email_address}', "");
                                    html = html.replace('{relation}', "");
                                    html = html.replace('{address}', "");
                                    html = html.replace('{style}', ' <td style="display:none;padding-top:20px; color:#000;">')
                                    html = html.replace('{styleclose}', "</td>")

                                } else {
                                    html = html.replace('{person_with_more_information}', "PERSON WITH MORE INFORMATION");


                                    html = html.replace('{additional_information_name}', intelData.additional_information.name || "N/A");
                                    html = html.replace('{additional_information_phone_number}', intelData.additional_information.phone_number || "N/A");
                                    html = html.replace('{additional_information_email}', intelData.additional_information.email || "N/A");
                                    html = html.replace('{additional_information_relation}', intelData.additional_information.relationship_title || "N/A");

                                    if (intelData.additional_information.address != undefined && typeof intelData.additional_information.address == "string" && intelData.additional_information.address.length > 0) {
                                        html = html.replace('{additional_information_address}', intelData.additional_information.address);
                                    } else if (intelData.additional_information.address != undefined && intelData.additional_information.address.address != undefined && typeof intelData.additional_information.address.address == "string" && intelData.additional_information.address.address.length > 0) {
                                        html = html.replace('{additional_information_address}', intelData.additional_information.address.address);
                                    } else {
                                        html = html.replace('{additional_information_address}', "N/A");
                                    }

                                    html = html.replace('{name}', "Name");
                                    html = html.replace('{phone}', "Phone");
                                    html = html.replace('{email_address}', "Email Address");
                                    html = html.replace('{relation}', "Relation");
                                    html = html.replace('{address}', "Address");
                                    html = html.replace('{style}', ' <td style="display:block;padding-top:20px; color:#000;">')
                                    html = html.replace('{styleclose}', "</td>")
                                }



                                if (intelData.additional_information.other_description != undefined && intelData.additional_information.other_description != null && intelData.additional_information.other_description != "") {
                                    html = html.replace('{additional_information_other_description_head}', "ADDITIONAL INFORMATION");
                                    html = html.replace('{additional_information_other_description_headd}', "ADDITIONAL INFORMATION: ");
                                    html = html.replace('{additional_information_other_description}', intelData.additional_information.other_description);
                                } else {
                                    html = html.replace('{additional_information_other_description_head}', "")
                                    html = html.replace('{additional_information_other_description_headd}', "");;
                                    html = html.replace('{additional_information_other_description}', "");
                                }





                            } else {
                                html = html.replace('{additional_information_name}', "N/A");
                                html = html.replace('{additional_information_phone_number}', "N/A");
                                html = html.replace('{additional_information_email}', "N/A");
                                html = html.replace('{additional_information_relation}', "N/A");
                                html = html.replace('{additional_information_other_description}', "N/A");
                                html = html.replace('{additional_information_address}', "N/A");
                            }

                            var contactPrefHtml = ''
                            if (disableContactPreference == true) {

                            } else {
                                contactPrefHtml = '<tr><td style="padding-top:20px; color:#000;"><label style="font-size: 15px;"><u>CONTACT PREFERENCE</u></label><br /><label style="font-size:13px; color:#808080;">Contact for Further Information:</label><label style="font-size:13px;"> {do_not_contact} </label></td></tr>'
                                if (intelData.contact_preference && intelData.contact_preference == 1) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "Requested Call Back")
                                } else if (intelData.contact_preference && intelData.contact_preference == 2) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "Text Message")
                                } else if (intelData.contact_preference && intelData.contact_preference == 3) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "DO NOT CONTACT")
                                } else if (intelData.contact_preference && intelData.contact_preference == 0) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "N/A")
                                } else if (intelData.do_not_contact == true) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "No")
                                } else {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "Yes")
                                }
                            }
                            html = html.replace("{send_contact_preference}", contactPrefHtml)
                            html = html.replace("{alert_description}", intelData.alert_description || "N/A");
                            //#endregion html template
                            var intelReportFileName = intelData.report_id + '-full.pdf';
                            var pdfreport = new Promise(function (resolve, reject) {
                                pdf.create(html, options).toFile('./tmp/' + intelReportFileName, function (err, buff) {
                                    if (err) {
                                        console.error(err)
                                        reject(false)
                                    } else {
                                        resolve(true)
                                    }
                                })
                            })
                            resl(pdfreport)
                        }
                    } else {
                        rejt(new Error(intelData.status_code))
                    }
                } else {
                    rejt(new Error("Unable to load data from server"))
                }
            }
        });
    })
};

exports.intelSummaryReport = (authToken, intelId, includeMedia, disableContactPreference,includeCaseNotes,req, res) => {
    var caseNotesData=[];
    var caseNotesHtml='';
   
    // API Params
    var apiUrl = process.env.API_HOST + '/getalertdetails?intel_id=' + intelId;
    const clientServerOptions = {
        uri: apiUrl,
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + authToken,
            'client_ip': req.session.client_ip,
            'is_public': req.session.is_public
        }
    }
    // API Call
    return new Promise( async function (resl, rejt) {        
        request(clientServerOptions, async function (apierr, apires) {
            if (apierr) {
                rejt(apierr)
            } else {
                var responseBody = apires.body;
                if (responseBody != undefined && responseBody != null) {
                    var intelData = JSON.parse(responseBody);
                   
                    if (intelData.status_code == 200) { 
                        if(intelData.category==3 || intelData.category==7){                                                       
                            return intelEmergencyReport(authToken, intelId, includeMedia, disableContactPreference, includeCaseNotes, intelData, req, res, resl).then(y=>resl(y)).catch(e=>rejt(e));
                        }else{
                            //#region html template
                            var html = fs.readFileSync(path.join(__dirname, 'intel-report-common.html'), 'utf8');
                            var options = {
                                format: 'Letter',
                                timeout: 300000,
                                childProcessOptions: { 
                                    env: { 
                                        OPENSSL_CONF: '/dev/null' 
                                    } 
                                }
                            };
                            var currentDate = moment().tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
                            var tz = req.query.tz;
                            // if(tz){
                            //     currentDate = moment().tz(tz).format('MM-DD-YYYY LTS');
                            // }
                            if(req.session!=undefined && req.session.isLocationAdmin!=undefined && req.session.isLocationAdmin && req.session.locationDropdown!=undefined && req.session.locationDropdown[0].region_name!=undefined && req.session.locationDropdown[0].region_name!=''){
                                html = html.replace("{organization_name}", req.session.locationDropdown[0].region_name || "N/A");
                            }else{  
                                // organization_name
                                html = html.replace("{organization_name}", intelData.organization_name || "N/A");
                            }

                            if(includeCaseNotes!=undefined && includeCaseNotes!='' && includeCaseNotes!=0 && includeCaseNotes!='0'){
                                var apiUrl = process.env.API_HOST + '/getintelcases?intel_id=' + intelId;
                                const reqBody = {intel_id:intelId, pagesize: 500};
                                // region user check
                                if(
                                    (req.session.isLocationAdmin != undefined && req.session.isLocationAdmin == true) && 
                                    (req.session.locationDropdown != undefined && Array.isArray(req.session.locationDropdown) && req.session.locationDropdown.length > 0)
                                ){
                                    regionData = req.session.locationDropdown.find(e => e.region_id != undefined);
                                    if(regionData != undefined && regionData != '' && regionData.region_name != undefined && regionData.region_name != ''){
                                        reqBody.is_region_user_for_sms_chat = true;
                                    }
                                }
                                const casesOptions = {
                                    uri: apiUrl,
                                    method: "POST",
                                    body: JSON.stringify(reqBody),
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": "Bearer " + authToken,
                                        'client_ip': req.session.client_ip,
                                        'is_public': req.session.is_public
                                    }
                                }
                                var caseNotesHtmlIn = await new Promise( function (resl, rejt) {
                                    request(casesOptions, function (apierr, apires) {
                                        var responseBody = apires.body;
                                        if (responseBody != undefined && responseBody != null) {
                                            caseNotesData = JSON.parse(responseBody);
                                            var caseNotesHtml='';
                                            caseNotesHtml+='<div style="page-break-before: always;height: auto;max-width: 500px;width: auto;">';
                                            caseNotesHtml += `<label style="font-size: 15px;"><u>CASE NOTES & ACTIVITY</u></label><br><br>`;
                                            if(caseNotesData!=undefined && caseNotesData.cases.length>0){
                                                for (var incr = 0; caseNotesData.cases.length > incr; incr++){
                                                    caseNotesHtml += '<div style="margin-bottom: 20px;">';
                                                    //[MM/DD/YY] @ [HH:MM:SS] 
                                                    //[FirstName] [LastName]: [CaseNoteAction & Updated Value] 
                                                    var dateShow = '';
                                                    dateShow = moment.utc(caseNotesData.cases[incr].created_datetime).tz('America/New_York').format('MM/DD/YYYY @ LTS')+" EST";
                                                    caseNotesHtml += `<label style="font-size: 13px;">${dateShow}</label><br/>`;
                                                    caseNotesHtml += `<div style="font-size: 13px;">${getCaseNotesHtml(caseNotesData.cases[incr], intelData.submitter.phone_number)}</div>`;
                                                    // if(caseNotesData.cases[incr].comment_text != undefined && caseNotesData.cases[incr].comment_text != ''){                                        
                                                    //     caseNotesHtml += `<label style="font-size: 13px;">`;
                                                    //     if(caseNotesData.cases[incr].submitter.first_name != undefined && caseNotesData.cases[incr].submitter.first_name != ''){
                                                    //         caseNotesHtml += caseNotesData.cases[incr].submitter.first_name;
                                                    //         if(caseNotesData.cases[incr].submitter.last_name != undefined && caseNotesData.cases[incr].submitter.last_name != ''){
                                                    //             caseNotesHtml += ` ${caseNotesData.cases[incr].submitter.last_name}`;
                                                    //         }
                                                    //         caseNotesHtml += ': ';
                                                    //     }
                                                    //     caseNotesHtml += `${caseNotesData.cases[incr].comment_text}</label><br/><br/>`;
                                                    // } else {
                                                    //     caseNotesHtml += `<div style="font-size: 13px;">${getCaseNotesHtml(caseNotesData.cases[incr], intelData.submitter.phone_number)}</div>`;
                                                    // }
                                                    caseNotesHtml += '</div>';
                                                }
                                                caseNotesHtml += '</div>';
                                                // caseNotesHtml+='</table></td></tr></table>';
                                                resl(caseNotesHtml)
                                            }else{
                                                caseNotesHtml+='<div><label style="font-size: 15px;"><b>N/A</b></label></div>';
                                                resl(caseNotesHtml)
                                            }
                                        }
                                    })
                                }).catch(err => {
                                    console.error(err);
                                    //html = html.replace("{case_notes}", "");
                                })
                                if(caseNotesHtmlIn!=undefined){
                                    html = html.replace("{case_notes}", caseNotesHtmlIn);
                                }else{
                                    html = html.replace("{case_notes}", ""); 
                                }
                            }else{
                                html = html.replace("{case_notes}", ""); 
                            }
                            if(req.session!=undefined && req.session.isLocationAdmin!=undefined && req.session.isLocationAdmin && req.session.locationDropdown!=undefined && req.session.locationDropdown[0].region_name!=undefined && req.session.locationDropdown[0].region_name!=''){                                
                                if(req.session.locationDropdown[0].region_logo!=undefined && req.session.locationDropdown[0].region_logo!=''){
                                    var imageFile = process.env.MEDIA_HOST +  req.session.locationDropdown[0].region_logo;
                                    html = html.replace("{organization_logo}", '<img src="' + imageFile + '" alt="' + req.session.locationDropdown[0].region_name + '" width="100" height="100">');
                                }else{
                                    html = html.replace("{organization_logo}", '');
                                }                               
                            }else{  
                                // organization_logo
                                if (intelData.organization_logo != "" && intelData.organization_logo != undefined) {
                                    var imageFile = process.env.MEDIA_HOST + intelData.organization_logo;
                                    var imgData = await new Promise((res, rej) => {
                                        request.get(imageFile, function (error, response, body) {
                                            if (!error && response.statusCode == 200) {
                                                data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                                res(data)
                                            } else {
                                                res(imageFile)
                                            }
                                        });
                                    })
                                    html = html.replace("{organization_logo}", '<img src="' + imgData + '" alt="' + intelData.organization_name + '" width="100" height="100">');
                                } else {
                                    html = html.replace("{organization_logo}", "");
                                }
                            }
                            // location_name
                            if (intelData.category == 5) {
                                html = html.replace("{location_name}", intelData.organization_name || "N/A");
                            } else {
                                html = html.replace("{location_name}", intelData.location_name);
                            }
                            // location_logo
                            if (intelData.location_logo != "" && intelData.location_logo != undefined) {
                                var imageFile = process.env.MEDIA_HOST + intelData.location_logo;
                                var imgData = await new Promise((res, rej) => {
                                    request.get(imageFile, function (error, response, body) {
                                        if (!error && response.statusCode == 200) {
                                            data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                            res(data)
                                        } else {
                                            res(imageFile)
                                        }
                                    });
                                })
                                html = html.replace("{location_logo}", '<img src="' + imgData + '" alt="' + intelData.location_name + '" width="100" height="100">');
                            } else {
                                html = html.replace("{location_logo}", "");
                            }
                            var exportedBy = "";
                            if (intelData.report_exported_by != undefined && intelData.report_exported_by.first_name) {
                                exportedBy = intelData.report_exported_by.first_name;
                                if (intelData.report_exported_by.last_name != undefined) {
                                    exportedBy += " " + intelData.report_exported_by.last_name;
                                }
                            }
                            html = html.replace("{exported_by}", exportedBy || "N/A");
                            html = html.replace("{generated_on}", currentDate || "N/A");
                            // html = html.replace("{numberofpages}", "N/A");
                            html = html.replace("{report_id}", intelData.report_id || "N/A");
                            html = html.replace("{report_id}", intelData.report_id || "N/A");
                            html = html.replace("{case_id}", intelData.case_id || "N/A");
                            html = html.replace("{case_id}", intelData.case_id || "N/A");
                            html = html.replace("{report_id_footer}", intelData.report_id || "N/A");
                            html = html.replace("{case_id_footer}", intelData.case_id || "N/A");
                            // report_type
                            switch (intelData.category) {
                                case 1:
                                    html = html.replace("{report_type}", "Tip");
                                    break;
                                case 2:
                                    html = html.replace("{report_type}", "Non-Emergency");
                                    break;
                                case 3:
                                    html = html.replace("{report_type}", "Emergency");
                                    break;
                                case 4:
                                    html = html.replace("{report_type}", "Live Video");
                                    break;
                                case 5:
                                    html = html.replace("{report_type}", "BOLO Tip");
                                    break;
                                case 6:
                                    html = html.replace("{report_type}", "SMS Intel");
                                    break;
                                case 7:
                                    html = html.replace("{report_type}", "Staff Assist");
                                    break;
                                case 8:
                                    html = html.replace("{report_type}", "Incident");
                                    break;    
                                case 9:
                                    html = html.replace("{report_type}", "SaferWalk Alarm");
                                    break;                                 
                                case 12:
                                    html = html.replace("{report_type}", "APLR");
                                    break;
                            }
                            // incident_type
                            if (intelData.category == 5) {
                                html = html.replace("{incident_type}", intelData.alert_data.alert_type.title + " Alert" || "N/A");
                            } else {
                                html = html.replace("{incident_type}", intelData.incident.title || "N/A");
                            }
                            // location_name
                            if (intelData.category == 5) {
                                html = html.replace("{location_name}", intelData.organization_name || "N/A");
                            } else {
                                html = html.replace("{location_name}", intelData.location_name || "N/A");
                            }

                            var date = new Date(intelData.create_datetime * 1000);
                            var incidentLocation = "N/A";
                            if (intelData.incident_geofence != undefined && intelData.incident_geofence.address != undefined && intelData.incident_geofence.address != "") {
                                incidentLocation = intelData.incident_geofence.address || "";
                                incidentLocation = ((intelData.incident_geofence.radius != undefined && intelData.incident_geofence.radius != 0) ? intelData.incident_geofence.radius + " ft from " : "") + incidentLocation;
                                incidentLocation = incidentLocation.toString()//.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                            } else {
                                incidentLocation = "Unknown Address Selected";
                            }
                            html = html.replace("{incident_location}", incidentLocation);
                            html = html.replace("{incident_description}", intelData.alert_description || "N/A");
                            var incidentDate = "N/A";
                            var inDTime = "";
                            switch (intelData.incident_datetime_type) {
                                case 1:
                                case "1":
                                    incidentDate = "Happening Now ";
                                    inDTime = moment(intelData.create_datetime, 'X').tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
                                    break;
                                case 2:
                                case "2":
                                    incidentDate = "Has Happened ";
                                    if (intelData.incident_datetime != undefined && intelData.incident_datetime != "") {
                                        inDTime = moment.utc(intelData.incident_datetime).tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
                                        if(intelData.category == 8 && process.env.CREATE_INCIDENT_REPORT_TIME > intelData.incident_datetime){
                                            inDTime = moment(intelData.incident_datetime).tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
                                        }
                                    }
                                    break;
                                case 3:
                                case "3":
                                    incidentDate = "Going to Happen ";
                                    if (intelData.incident_datetime != undefined && intelData.incident_datetime != "") {
                                        inDTime = moment.utc(intelData.incident_datetime).tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
                                    }
                                    break;
                            }
                            // if(tz){
                            //     if(intelData.incident_datetime_type == 1){
                            //         inDTime = moment.utc(intelData.create_datetime,'X').tz(tz).format('MM-DD-YYYY LTS');
                            //     } else if(intelData.incident_datetime_type == 2 || intelData.incident_datetime_type == 3) {
                            //         if (intelData.incident_datetime != undefined && intelData.incident_datetime != "") {
                            //             inDTime = moment.utc(intelData.incident_datetime).tz(tz).format('MM-DD-YYYY LTS');
                            //         }
                            //     }
                            // }
                            incidentDate += inDTime;
                            html = html.replace("{incident_datetime}", incidentDate);
                            html = html.replace("{timeline_description}", intelData.timeline_description || "")

                            // incidentDetails
                            var incidentDetails = ""
                            if (intelData.category == 8) {
                                // sub location
                                incidentDetails += `<li style="font-size: 13px;"><label style="color:#808080;">Specific Location:</label> ${intelData.sub_location || 'N/A'}</li>`
                                // source
                                var incidentSource = ''
                                if (intelData.incident_source == 1) {
                                    incidentSource += (intelData.submitter.first_name != '') ? intelData .submitter.first_name : ''
                                    incidentSource += (intelData.submitter.last_name != '') ? ' ' + intelData.submitter.last_name : ''
                                    incidentSource += (intelData.submitter.email_id != '') ? ', ' + intelData.submitter.email_id : ''
                                    if (intelData.submitter.phone_number != undefined && intelData.submitter.phone_number != '') {
                                        var cleaned = ('' + intelData.submitter.phone_number).replace(/\D/g, '')
                                        var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
                                        if (match) {
                                            var intlCode = (match[1] ? '+1 ' : '')
                                            intelData.submitter.phone_number = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
                                        }
                                    }
                                    incidentSource += (intelData.submitter.phone_number != '') ? ', ' + intelData.submitter.phone_number : ''
                                } else if (intelData.incident_source == 2) {
                                    incidentSource += 'Anonymous'
                                } else if (intelData.incident_source == 4) {
                                    incidentSource += intelData.report_source
                                    incidentSource += (intelData.submitter.first_name != '') ? ', ' + intelData.submitter.first_name : ''
                                    incidentSource += (intelData.submitter.last_name != '') ? ' ' + intelData.submitter.last_name : ''
                                    incidentSource += (intelData.submitter.email_id != '') ? ', ' + intelData.submitter.email_id : ''
                                    if (intelData.submitter.phone_number != undefined && intelData.submitter.phone_number != '') {
                                        var cleaned = ('' + intelData.submitter.phone_number).replace(/\D/g, '')
                                        var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
                                        if (match) {
                                            var intlCode = (match[1] ? '+1 ' : '')
                                            intelData.submitter.phone_number = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
                                        }
                                    }
                                    incidentSource += (intelData.submitter.phone_number != '') ? ', ' + intelData.submitter.phone_number : ''
                                } else {
                                    incidentSource += 'N/A'
                                }
                                incidentDetails += `<li style="font-size: 13px;"><label style="color:#808080;">Source of Information:</label> ${incidentSource}</li>`
                                // Method Reported
                                incidentDetails += `<li style="font-size: 13px;"><label style="color:#808080;">Method Reported:</label> ${getIntelReportedMethod(intelData.report_method)}</li>`
                                // Classification/Severity
                                incidentDetails += `<li style="font-size: 13px;"><label style="color:#808080;">Classification/Severity:</label> ${incidentClassification(intelData.incident_classification || '0')}</li>`
                                // Division
                                incidentDetails += `<li style="font-size: 13px;"><label style="color:#808080;">Borough/Division:</label> ${intelData.incident_division || 'N/A'}</li>`
                                // Zone
                                incidentDetails += `<li style="font-size: 13px;"><label style="color:#808080;">Precinct/Zone:</label> ${intelData.incident_zone || 'N/A'}</li>`
                                // Department
                                var departments = ''
                                if (intelData.incident_departments && Array.isArray(intelData.incident_departments) && intelData.incident_departments.length > 0) {
                                    departments += intelData.incident_departments.map(d => d.name).join(', ')
                                } else if (intelData.incident_department_assigned != undefined && intelData.incident_department_assigned != null && intelData.incident_department_assigned != "") {
                                    departments += intelData.incident_department_assigned
                                } else {
                                    departments += 'N/A'
                                }
                                incidentDetails += `<li style="font-size: 13px;"><label style="color:#808080;">Department(s) Assigned:</label> ${departments}</li>`
                            }
                            html = html.replace("{incidentDetails}", incidentDetails)

                            var intelMedia = "";
                            if (!Array.isArray(intelData.media)) {
                                intelData.media = [];
                            }
                            if (includeMedia == 0) { //when include media checkbox is not checked
                                intelMedia += '<br />Contact Sender for Media Files';
                            } else if (includeMedia == 2) { //when there is no media
                                intelMedia += '<br />No Media Files Submitted';
                            } else { // when checkbox for include media is checked
                                intelMedia += '<ul>';
                                // images
                                var intelImages = intelData.media.filter(e => {
                                    return e.type == 1;
                                })
                                if (intelImages != undefined && intelImages.length > 0) {
                                    intelMedia += '<li>' + intelImages.length + ' Image(s)</br>';
                                    for (const el of intelImages) {
                                        var imageFile = process.env.MEDIA_HOST + el.s3key;
                                        var imgData = await new Promise((res, rej) => {
                                            request.get(imageFile, function (error, response, body) {
                                                if (!error && response.statusCode == 200) {
                                                    data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                                                    res(data)
                                                } else {
                                                    res(imageFile)
                                                }
                                            });
                                        })
                                        intelMedia += '<div style="page-break-before: always; page-break-after: always; width:auto;height:auto;max-width:100%;max-height:580px; text-align: center; margin-left: -40px;"><a href="' + imageFile + '" target="_blank" style="width:auto;height:auto;max-width:100%;max-height:580px;"><img src="' + imgData + '" style="width:auto;height:auto;max-width:100%;max-height:580px;"></a></div>';
                                    }
                                    intelMedia += '</li>'
                                } else {
                                    intelMedia += '<li>0 Image(s)</li>';
                                }
                                // videos
                                var intelVideos = intelData.media.filter(e => {
                                    return e.type == 2;
                                });
                                if (intelVideos != undefined && intelVideos.length > 0) {
                                    intelMedia += '<li>' + intelVideos.length + ' Video File(s)<ul>';
                                    intelVideos.forEach(el => {
                                        intelMedia += '<li><a target="_blank" href="' + process.env.MEDIA_HOST + el.s3key + '" target="_blank">' + el.s3key + '</a></li>';
                                    })
                                    intelMedia += '</ul></li>';
                                } else {
                                    intelMedia += '<li>0 Video File(s)</li>';
                                }
                                // audios
                                var intelAudios = intelData.media.filter(e => {
                                    return e.type == 3;
                                });
                                if (intelAudios != undefined && intelAudios.length > 0) {
                                    intelMedia += '<li>' + intelAudios.length + ' Audio File(s)<ul>';
                                    intelAudios.forEach(el => {
                                        intelMedia += '<li><a target="_blank" href="' + process.env.MEDIA_HOST + el.s3key + '" target="_blank">' + el.s3key + '</a></li>';
                                    })
                                    intelMedia += '</ul></li>';
                                } else {
                                    intelMedia += '<li>0 Audio File(s)</li>';
                                }
                                // pdfs
                                var intelPdfs = intelData.media.filter(e => {
                                    return e.type == 6;
                                });
                                if (intelPdfs != undefined && intelPdfs.length > 0) {
                                    intelMedia += '<li>' + intelPdfs.length + ' PDF File(s)<ul>';
                                    intelPdfs.forEach(el => {
                                        intelMedia += '<li><a target="_blank" href="' + process.env.MEDIA_HOST + el.s3key + '" target="_blank">' + el.s3key + '</a></li>';
                                    })
                                    intelMedia += '</ul></li>';
                                } else {
                                    intelMedia += '<li>0 PDF File(s)</li>';
                                }
                                intelMedia += '</ul>';
                                if (intelImages == undefined && intelVideos == undefined && intelAudios == undefined) {
                                    intelMedia = "<br />No Media Files Submitted";
                                }
                            }
                            html = html.replace("{media}", intelMedia);
                            // individual description
                            var individualInfo = "";
                            if (Array.isArray(intelData.individuals_info) && intelData.individuals_info.length > 0) {
                                for (let loopIndex = 0; loopIndex < intelData.individuals_info.length; loopIndex++) {
                                    const individualPersonInfo = intelData.individuals_info[loopIndex].person_info;
                                    individualInfo += '<tr><td style="padding-top:20px; color:#000;"><label class="indivisualIdHeading" style="font-size: 15px;"><u>INDIVIDUAL DESCRIPTION #' + (loopIndex + 1) + '</u></label><ul>';
                                    if (individualPersonInfo.gender != undefined && individualPersonInfo.gender != "") {
                                        if (individualPersonInfo.gender == 1) {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> Male</li>';
                                        } else if (individualPersonInfo.gender == 2) {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> Female</li>';
                                        } else {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> N/A</li>';
                                        }
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.ethnicity_id != undefined && individualPersonInfo.ethnicity_id != "") {
                                        individualInfo += ' <li style="font-size:13px;"><label style="color:#808080;">Ethnicity:</label> ' + individualPersonInfo.ethnicity_id + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Ethnicity:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.age != undefined && individualPersonInfo.age != "") {
                                        if (individualPersonInfo.age.age != undefined && individualPersonInfo.age.age != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> ' + individualPersonInfo.age.age + 'yrs</li>';
                                        } else if (individualPersonInfo.age.range_start != undefined && individualPersonInfo.age.range_start != "" && individualPersonInfo.age.range_end != undefined && individualPersonInfo.age.range_end != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> ' + individualPersonInfo.age.range_start + '-' + individualPersonInfo.age.range_end + ' yrs</li>';
                                        } else {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> N/A</li>';
                                        }
                                    }
                                    var hairs = '';
                                    if (individualPersonInfo.hair_color_id != undefined && individualPersonInfo.hair_color_id != "") {
                                        hairs += '<li style="font-size:13px;"> <label style="color:#808080;">Hair Color:</label> ' + individualPersonInfo.hair_color_id + ' {hair_type} </li>';
                                        if (individualPersonInfo.hair_type_id != undefined) {
                                            hairs = hairs.replace('{hair_type}', '<label style="color:#808080;">Hair Type: </label> ' + individualPersonInfo.hair_type_id || "N/A");
                                        } else {
                                            hairs = hairs.replace('{hair_type}', '<label style="color:#808080;">Hair Type:</label> N/A');
                                        }
                                    }
                                    individualInfo += hairs;
                                    if (individualPersonInfo.height != undefined) {
                                        if (individualPersonInfo.height.height != undefined && individualPersonInfo.height.height != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> ' + individualPersonInfo.height.height + 'ft</li>';
                                        } else if (individualPersonInfo.height.range_start != undefined && individualPersonInfo.height.range_start != "" && individualPersonInfo.height.range_end != undefined && individualPersonInfo.height.range_end != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> ' + individualPersonInfo.height.range_start + '-' + individualPersonInfo.height.range_end + ' ft</li>';
                                        } else {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> N/A</li>';
                                        }
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.weight != undefined && individualPersonInfo.weight != "") {
                                        if (individualPersonInfo.weight.weight != undefined && individualPersonInfo.weight.weight != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> ' + individualPersonInfo.weight.weight + ' Lbs</li>';
                                        } else if (individualPersonInfo.weight.range_start != undefined && individualPersonInfo.weight.range_start != "" && individualPersonInfo.weight.range_end != undefined && individualPersonInfo.weight.range_end != "") {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> ' + individualPersonInfo.weight.range_start + '-' + individualPersonInfo.weight.range_end + ' Lbs</li>';
                                        } else {
                                            individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> N/A</li>';
                                        }
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.name != undefined && individualPersonInfo.name != '') {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Name:</label> ' + individualPersonInfo.name + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Name:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.nickname != undefined && individualPersonInfo.nickname != '') {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Nickname:</label> ' + individualPersonInfo.nickname + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Nickname:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.eye_color_id != undefined && individualPersonInfo.eye_color_id != '') {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Eye Color:</label> ' + individualPersonInfo.eye_color_id + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Eye Color:</label> N/A</li>';
                                    }
                                    if (individualPersonInfo.facial_hair_id != undefined && individualPersonInfo.facial_hair_id != '') {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Facial Hair:</label> ' + individualPersonInfo.facial_hair_id + '</li>';
                                    } else {
                                        individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Facial Hair:</label> N/A</li>';
                                    }

                                    var hats = '<li style="font-size:13px;"> <label style="color:#808080;">Hat Color:</label> {hat_color_id} <label style="color:#808080;">Hat Type:</label> {hat_id}';
                                    if (individualPersonInfo.hat_color_id != undefined && individualPersonInfo.hat_color_id != '') {
                                        hats = hats.replace('{hat_color_id}', individualPersonInfo.hat_color_id);
                                    } else {
                                        hats = hats.replace('{hat_color_id}', "N/A");
                                    }
                                    if (individualPersonInfo.hat_id != undefined && individualPersonInfo.hat_id != '') {
                                        hats = hats.replace('{hat_id}', individualPersonInfo.hat_id);
                                    } else {
                                        hats = hats.replace('{hat_id}', "N/A");
                                    }
                                    individualInfo += hats;

                                    var shirts = '<li style="font-size:13px;"> <label style="color:#808080;">Shirt Color:</label> {shirt_color_id} <label style="color:#808080;">Shirt Type:</label> {shirt_type_id} </li>';
                                    if (individualPersonInfo.shirt_color_id != undefined && individualPersonInfo.shirt_color_id != "") {
                                        shirts = shirts.replace('{shirt_color_id}', individualPersonInfo.shirt_color_id);
                                    } else {
                                        shirts = shirts.replace('{shirt_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.shirt_type_id != undefined && individualPersonInfo.shirt_type_id != '') {
                                        shirts = shirts.replace('{shirt_type_id}', individualPersonInfo.shirt_type_id);
                                    } else {
                                        shirts = shirts.replace('{shirt_type_id}', "N/A");
                                    }
                                    individualInfo += shirts;

                                    var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Pant Color:</label> {pants_color_id} <label style="color:#808080;">Pant Type:</label> {pants_type_id} </li>';
                                    if (individualPersonInfo.pants_color_id != undefined && individualPersonInfo.pants_color_id != "") {
                                        obj = obj.replace('{pants_color_id}', individualPersonInfo.pants_color_id);
                                    } else {
                                        obj = obj.replace('{pants_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.pants_type_id != undefined && individualPersonInfo.pants_type_id != '') {
                                        obj = obj.replace('{pants_type_id}', individualPersonInfo.pants_type_id);
                                    } else {
                                        obj = obj.replace('{pants_type_id}', "N/A");
                                    }
                                    individualInfo += obj;

                                    var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Dress Color:</label> {dress_color_id} <label style="color:#808080;">Dress Type:</label> {dress_type_id} </li>';
                                    if (individualPersonInfo.dress_color_id != undefined && individualPersonInfo.dress_color_id != "") {
                                        obj = obj.replace('{dress_color_id}', individualPersonInfo.dress_color_id);
                                    } else {
                                        obj = obj.replace('{dress_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.dress_type_id != undefined && individualPersonInfo.dress_type_id != '') {
                                        obj = obj.replace('{dress_type_id}', individualPersonInfo.dress_type_id);
                                    } else {
                                        obj = obj.replace('{dress_type_id}', "N/A");
                                    }
                                    individualInfo += obj;

                                    var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Outwear Color:</label> {outerwear_color_id} <label style="color:#808080;">Outwear Type:</label> {outerwear_type_id} </li>';
                                    if (individualPersonInfo.outerwear_color_id != undefined && individualPersonInfo.outerwear_color_id != "") {
                                        obj = obj.replace('{outerwear_color_id}', individualPersonInfo.outerwear_color_id);
                                    } else {
                                        obj = obj.replace('{outerwear_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.outerwear_type_id != undefined && individualPersonInfo.outerwear_type_id != '') {
                                        obj = obj.replace('{outerwear_type_id}', individualPersonInfo.outerwear_type_id);
                                    } else {
                                        obj = obj.replace('{outerwear_type_id}', "N/A");
                                    }
                                    individualInfo += obj;

                                    var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Shoe Color:</label> {shoe_color_id} <label style="color:#808080;">Shoe Type:</label> {shoe_type_id} </li>';
                                    if (individualPersonInfo.shoe_color_id != undefined && individualPersonInfo.shoe_color_id != "") {
                                        obj = obj.replace('{shoe_color_id}', individualPersonInfo.shoe_color_id);
                                    } else {
                                        obj = obj.replace('{shoe_color_id}', 'N/A');
                                    }
                                    if (individualPersonInfo.shoe_type_id != undefined && individualPersonInfo.shoe_type_id != '') {
                                        obj = obj.replace('{shoe_type_id}', individualPersonInfo.shoe_type_id);
                                    } else {
                                        obj = obj.replace('{shoe_type_id}', "N/A");
                                    }
                                    individualInfo += obj;

                                    individualInfo += '</ul> </td> </tr>';
                                }
                            }
                            html = html.replace('{individualInfo}', individualInfo);
                            if (intelData.additional_information != undefined) {
                                if ((intelData.additional_information.name == undefined || intelData.additional_information.name == null || intelData.additional_information.name == "") && (intelData.additional_information.phone_number == undefined || intelData.additional_information.phone_number == null || intelData.additional_information.phone_number == "") && (intelData.additional_information.email == undefined || intelData.additional_information.email == null || intelData.additional_information.email == "") && (intelData.additional_information.relationship_title == undefined || intelData.additional_information.relationship_title == null || intelData.additional_information.relationship_title == "") && (intelData.additional_information.address == undefined || intelData.additional_information.address == null || intelData.additional_information.address == "")) {
                                    html = html.replace('{person_with_more_information}', "");
                                    html = html.replace('{additional_information_name}', "");
                                    html = html.replace('{additional_information_phone_number}', "");
                                    html = html.replace('{additional_information_email}', "");
                                    html = html.replace('{additional_information_relation}', "");
                                    if (intelData.additional_information.address != undefined && typeof intelData.additional_information.address == "string" && intelData.additional_information.address.length > 0) {
                                        html = html.replace('{additional_information_address}', "");
                                    } else if (intelData.additional_information.address != undefined && intelData.additional_information.address.address != undefined && typeof intelData.additional_information.address.address == "string" && intelData.additional_information.address.address.length > 0) {
                                        html = html.replace('{additional_information_address}', "");
                                    } else {
                                        html = html.replace('{additional_information_address}', "");
                                    }
                                    html = html.replace('{name}', "");
                                    html = html.replace('{phone}', "");
                                    html = html.replace('{email_address}', "");
                                    html = html.replace('{relation}', "");
                                    html = html.replace('{address}', "");
                                    html = html.replace('{style}', ' <td style="display:none;padding-top:20px; color:#000;">')
                                    html = html.replace('{styleclose}', "</td>")
                                } else {
                                    html = html.replace('{person_with_more_information}', "PERSON WITH MORE INFORMATION");
                                    html = html.replace('{additional_information_name}', intelData.additional_information.name || "N/A");
                                    html = html.replace('{additional_information_phone_number}', intelData.additional_information.phone_number || "N/A");
                                    html = html.replace('{additional_information_email}', intelData.additional_information.email || "N/A");
                                    html = html.replace('{additional_information_relation}', intelData.additional_information.relationship_title || "N/A");
                                    if (intelData.additional_information.address != undefined && typeof intelData.additional_information.address == "string" && intelData.additional_information.address.length > 0) {
                                        html = html.replace('{additional_information_address}', intelData.additional_information.address);
                                    } else if (intelData.additional_information.address != undefined && intelData.additional_information.address.address != undefined && typeof intelData.additional_information.address.address == "string" && intelData.additional_information.address.address.length > 0) {
                                        html = html.replace('{additional_information_address}', intelData.additional_information.address.address);
                                    } else {
                                        html = html.replace('{additional_information_address}', "N/A");
                                    }
                                    html = html.replace('{name}', "Name");
                                    html = html.replace('{phone}', "Phone");
                                    html = html.replace('{email_address}', "Email Address");
                                    html = html.replace('{relation}', "Relation");
                                    html = html.replace('{address}', "Address");
                                    html = html.replace('{style}', ' <td style="display:block;padding-top:20px; color:#000;">')
                                    html = html.replace('{styleclose}', "</td>")
                                }
                                if (intelData.additional_information.other_description != undefined && intelData.additional_information.other_description != null && intelData.additional_information.other_description != "") {
                                    html = html.replace('{additional_information_other_description_head}', "ADDITIONAL INFORMATION");
                                    html = html.replace('{additional_information_other_description_headd}', "ADDITIONAL INFORMATION: ");
                                    html = html.replace('{additional_information_other_description}', intelData.additional_information.other_description);
                                } else {
                                    html = html.replace('{additional_information_other_description_head}', "")
                                    html = html.replace('{additional_information_other_description_headd}', "");;
                                    html = html.replace('{additional_information_other_description}', "");
                                }
                            } else {
                                html = html.replace('{additional_information_name}', "N/A");
                                html = html.replace('{additional_information_phone_number}', "N/A");
                                html = html.replace('{additional_information_email}', "N/A");
                                html = html.replace('{additional_information_relation}', "N/A");
                                html = html.replace('{additional_information_other_description}', "N/A");
                                html = html.replace('{additional_information_address}', "N/A");
                            }
                            
                            var contactPrefHtml = ''
                            if(intelData.category == 12){
                                disableContactPreference = true;
                                contactPrefHtml = `
                                 <tr>
                                     <td style="padding-top:2px; color:#000;">
                                        <label style="font-size: 15px;"><u>Vehicle Details</u></label>
                                        <ul>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">License Plate:</label> ${intelData.more_info.numberPlate && intelData.more_info.numberPlate !== "-"?  intelData.more_info.numberPlate : "N/A"}</li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Model:</label> ${intelData.more_info.vehicleModel  && intelData.more_info.vehicleModel !== "-"? intelData.more_info.vehicleModel : "N/A"}</li>
                                            <li style="font-size: 13px;"> 
                                                <label style="color:#808080;">Color:</label> ${intelData.more_info.vehicleColor && intelData.more_info.vehicleColor !== "-"? intelData.more_info.vehicleColor: "N/A"}</li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Registration State:</label> ${intelData.more_info.vehicleRegistrationState && intelData.more_info.vehicleRegistrationState !== "-"? intelData.more_info.vehicleRegistrationState : "N/A"}
                                            </li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Make:</label> ${intelData.more_info.vehicleMake && intelData.more_info.vehicleMake !== "-"? intelData.more_info.vehicleMake : "N/A"}
                                            </li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Year:</label> ${intelData.more_info.vehicleYearOfRegistration && intelData.more_info.vehicleYearOfRegistration !== "-"? intelData.more_info.vehicleYearOfRegistration: "N/A"}
                                            </li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                     <td style="padding-top:2px; color:#000;">
                                        <label style="font-size: 15px;"><u>LPR HIT Details</u></label>
                                        <ul>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Incident ID:</label> <span style="word-break: break-word; white-space: normal;width:100%; display:block">${intelData.more_info.incidentId || 'N/A'}</span></li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Date & Time:</label> ${intelData.more_info.activationTime ? moment.utc(intelData.more_info.activationTime).tz('America/New_York').format('MM-DD-YYYY LTS')+" EST" : "N/A"}</li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Camera Name:</label> ${intelData.more_info.cameraName || "N/A"}</li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Location:</label> ${(intelData.user_location.latitude + ", " + intelData.user_location.longitude) || "N/A"}
                                            </li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Sublocation:</label> ${intelData.more_info.subLocation || "N/A"}
                                            </li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Address:</label> ${intelData.user_location.address || "N/A"}
                                            </li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Category:</label> ${intelData.more_info.category || "N/A"}
                                            </li>
                                            <li style="font-size: 13px;">
                                                <label style="color:#808080;">Notes:</label> ${intelData.more_info?.addtionalInformation?.comments || "N/A"}
                                            </li>
                                        </ul>
                                    </td>
                                </tr>
                                `
                            }

                            if (disableContactPreference == true) {

                            } else {
                                contactPrefHtml = '<tr><td style="padding-top:20px; color:#000;"><label style="font-size: 15px;"><u>CONTACT PREFERENCE</u></label><br /><label style="font-size:13px; color:#808080;">Contact for Further Information:</label><label style="font-size:13px;"> {do_not_contact} </label><label style="font-size:13px;"> {contact_preference} </label></td></tr>'
                                var contactPreference = '';
                                if (intelData.contact_preference && intelData.contact_preference == 1) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "Requested Call Back")
                                } else if (intelData.contact_preference && intelData.contact_preference == 2) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "Text Message")
                                } else if (intelData.contact_preference && intelData.contact_preference == 3) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "DO NOT CONTACT")
                                } else if (intelData.contact_preference && intelData.contact_preference == 0) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "N/A")
                                } else if (intelData.do_not_contact == true) {
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "No")
                                } else {
                                    contactPreference += '<label>';
                                    contactPreference += '<ul>';
                                    contactPreference += '<li style="font-size: 13px;">';
                                    contactPreference += '<label style="color:#808080;">Submitter: </label>';
                                    if (intelData.anonymous == true) {
                                        contactPreference += 'Anonymous';
                                    } else {
                                        contactPreference += intelData.submitter.first_name + ' ' + intelData.submitter.last_name;
                                    }

                                    contactPreference += '</li>';
                                    contactPreference += '<li style="font-size: 13px;">';

                                    var cleaned = ('' + intelData.submitter.phone_number).replace(/\D/g, '')
                                    var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
                                    if (match) {
                                        var intlCode = (match[1] ? '+1 ' : '')
                                        intelData.submitter.phone_number = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
                                    }
                                    contactPreference += '<label style="color:#808080;">Phone: </label>' + intelData.submitter.country_code + "- " + intelData.submitter.phone_number + '</li>';
                                    contactPreference += '</ul>';
                                    contactPreference += '</label>';
                                    contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "Yes")
                                }
                                contactPrefHtml = contactPrefHtml.replace("{contact_preference}", contactPreference);
                            }
                            html = html.replace("{send_contact_preference}", contactPrefHtml)
                            html = html.replace("{alert_description}", intelData.alert_description || "N/A");
                            html = html.replace(/ :/g,":");
                            //#endregion html template
                            var intelReportFileName = intelData.report_id + '-summary.pdf';
                            fs.writeFileSync(`./tmp/${intelReportFileName}.html`, html);
                            var pdfreport = new Promise(function (resolve, reject) {
                                pdf.create(html, options).toFile('./tmp/' + intelReportFileName, function (err, buff) {
                                    if (err) {
                                        console.error(err)
                                        reject(false)
                                    } else {
                                        resolve(true)
                                    }
                                })
                            })
                            
                            resl(pdfreport)
                        }
                    } else {
                        rejt(new Error(intelData.status_code))
                    }
                } else {
                    rejt(new Error("Unable to load data from server"))
                }
            }
        });
    })
};

async function intelEmergencyReport(authToken, intelId, includeMedia, disableContactPreference, includeCaseNotes, intelData, req, res, resl,isFullReport=false){
    var html = fs.readFileSync(path.join(__dirname, 'intel-report-emergency.html'), 'utf8');
    var reasonForCancellation='';
    var cancelledByFirstName='';
    var cancelledByLastName='';
    if(intelData.category==7){   
        html = fs.readFileSync(path.join(__dirname, 'intel-report-staff-assist.html'), 'utf8');
    }    
    var options = {
        "format": "Letter",
        timeout: 300000,
        "orientation": "portrait",
        childProcessOptions: { 
            env: { 
                OPENSSL_CONF: '/dev/null' 
            } 
        }
    };
    var currentDate = moment().tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
    if(req.session!=undefined && req.session.isLocationAdmin!=undefined && req.session.isLocationAdmin && req.session.locationDropdown!=undefined && Array.isArray(req.session.locationDropdown) && req.session.locationDropdown.length > 0 && req.session.locationDropdown[0].region_name!=undefined && req.session.locationDropdown[0].region_name!=''){
        html = html.replace("{organization_name}", req.session.locationDropdown[0].region_name || "N/A");
    }else{    
        // organization_name
        html = html.replace("{organization_name}", intelData.organization_name || "N/A");
    }
    const userObj = new UserListHelper();
    req.query={
        email_id:intelData.submitter.email_id,
        location_id: intelData.location_id
    }
    var userInfo = await userObj.getuserprofiledetailsbyuserid(req, res).then(uobj=>{ return uobj}).catch(e=>{return e});
    if(userInfo!=undefined && userInfo.user_details!=undefined && userInfo.user_details.profile!=undefined && userInfo.user_details.profile.title!=undefined && userInfo.user_details.profile.title!=''){
        html = html.replace("{submitter_title}", userInfo.user_details.profile.title);
    }else{
        html = html.replace("{submitter_title}", "N/A");
    }
    if(userInfo!=undefined && userInfo.user_details!=undefined && userInfo.user_details.profile!=undefined && userInfo.user_details.profile.division!=undefined && userInfo.user_details.profile.division!=''){
        html = html.replace("{submitter_division_department}", userInfo.user_details.profile.division);
    }else{
        html = html.replace("{submitter_division_department}", "N/A");
    }
    //if(includeCaseNotes!=undefined && includeCaseNotes!='' && includeCaseNotes!=0 && includeCaseNotes!='0'){
        var apiUrl = process.env.API_HOST + '/gettimelineupdates?intel_id=' + intelId;
        const casesOptions = {
            uri: apiUrl,
            method: "POST",
            body: JSON.stringify({intel_id:intelId, pagesize: 100}),
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + authToken,
                'client_ip': req.session.client_ip,
                'is_public': req.session.is_public
            }
        }
        
        var caseNotesHtmlIn = await new Promise( function (resl, rejt) {
            request(casesOptions, function (apierr, apires) {
                var responseBody = apires.body;
                if (responseBody != undefined && responseBody != null) {
                    timeLineData = JSON.parse(responseBody);
                    var caseNotesHtml='';
                    if(includeCaseNotes!=undefined && includeCaseNotes!='' && includeCaseNotes!=0 && includeCaseNotes!='0'){
                        caseNotesHtml+='<tr><td><div style="page-break-before: always; width:auto;height:auto;max-width:100%;"><label style="font-size: 15px;"><b><u>TIMELINE & CASE NOTES</u></b></label><br>';  
                    }                                     
                    if(timeLineData!=undefined && timeLineData.timeline_updates.length>0){
                        for(var incr=0; timeLineData.timeline_updates.length>incr; incr++){
                            var timeLine = timeLineData.timeline_updates[incr];
                            var dateShow = '';
                            if(timeLine.action == 6) {
                                reasonForCancellation= timeLine.alert_description;
                            }  
                            if(timeLine.action_type == 12){
                                reasonForCancellation= timeLine.comment_text;
                            }
                            if(timeLine.is_reporter!=true) {                                
                                cancelledByFirstName=timeLine.submitter.first_name;
                                cancelledByLastName=timeLine.submitter.last_name
                            } 
                            if(includeCaseNotes!=undefined && includeCaseNotes!='' && includeCaseNotes!=0 && includeCaseNotes!='0'){                 
                                dateShow = moment(timeLine.created_datetime*1000).tz('America/New_York').format('MM/DD/YYYY @ LTS')+" EST";
                                caseNotesHtml+='<br><span style="font-size: 13px;">'+dateShow+'</span>';                                                
                                caseNotesHtml+='<span style="font-size: 13px;">'+getEmgTimeLineHtml(timeLine, intelData.submitter.first_name, intelData.submitter.last_name )+'</span>';
                            }
                        }
                        if(includeCaseNotes!=undefined && includeCaseNotes!='' && includeCaseNotes!=0 && includeCaseNotes!='0'){
                            caseNotesHtml+='</div></td></tr>';
                        }
                        //caseNotesHtml+='</table></td></tr></table>';
                        resl(caseNotesHtml)
                    }else{
                        if(includeCaseNotes!=undefined && includeCaseNotes!='' && includeCaseNotes!=0 && includeCaseNotes!='0'){
                            caseNotesHtml+='<tr><td><div><label style="font-size: 15px;"><b>N/A</b></label></div></td></tr>';         
                        }                              
                        resl(caseNotesHtml)
                    }
                }
            })
        }).catch(err => {
            console.error(err);
            //html = html.replace("{case_notes}", "");
        })
        if(caseNotesHtmlIn!=undefined){
            html = html.replace("{case_notes}", caseNotesHtmlIn);
        }else{
            html = html.replace("{case_notes}", ""); 
        }
    // }else{
    //     html = html.replace("{case_notes}", ""); 
    // }
    if(req.session!=undefined && req.session.isLocationAdmin!=undefined && req.session.isLocationAdmin && req.session.locationDropdown!=undefined && req.session.locationDropdown[0].region_name!=undefined && req.session.locationDropdown[0].region_name!=''){                                
        if(req.session.locationDropdown[0].region_logo!=undefined && req.session.locationDropdown[0].region_logo!=''){
            var imageFile = process.env.MEDIA_HOST +  req.session.locationDropdown[0].region_logo;
            html = html.replace("{organization_logo}", '<img src="' + imageFile + '" alt="' + req.session.locationDropdown[0].region_name + '" width="100" height="100">');
        }else{
            html = html.replace("{organization_logo}", '');
        }                               
    }else{  
        // organization_logo
        if (intelData.organization_logo != "" && intelData.organization_logo != undefined) {
            var imageFile = process.env.MEDIA_HOST + intelData.organization_logo;
            var imgData = await new Promise((res, rej) => {
                request.get(imageFile, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                        res(data)
                    } else {
                        res(imageFile)
                    }
                });
            })
            html = html.replace("{organization_logo}", '<img src="' + imgData + '" alt="' + intelData.organization_name + '" width="100" height="100">');
        } else {
            html = html.replace("{organization_logo}", "");
        }
    }
    // location_name
    if (intelData.category == 5) {
        html = html.replace("{reporter_location_name}",  intelData.organization_name || "N/A");
    } else {
        html = html.replace("{location_name}", intelData.location_name || "N/A");
        //html = html.replace("{reporter_location_name}", intelData.location_name+", "+intelData.organization_name || "N/A");
        html = html.replace("{reporter_location_name}", intelData.location_name || "N/A");
    }
    // location_logo
    if (intelData.location_logo != "" && intelData.location_logo != undefined) {
        var imageFile = process.env.MEDIA_HOST + intelData.location_logo;
        var imgData = await new Promise((res, rej) => {
            request.get(imageFile, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                    res(data)
                } else {
                    res(imageFile)
                }
            });
        })
        html = html.replace("{location_logo}", '<img src="' + imgData + '" alt="' + intelData.location_name + '" width="100" height="100">');
    } else {
        html = html.replace("{location_logo}", "");
    }
    var exportedBy = "";
    if (intelData.report_exported_by != undefined && intelData.report_exported_by.first_name) {
        exportedBy = intelData.report_exported_by.first_name;
        if (intelData.report_exported_by.last_name != undefined) {
            exportedBy += " " + intelData.report_exported_by.last_name;
        }
    }
    html = html.replace("{exported_by}", exportedBy || "N/A");
    html = html.replace("{generated_on}", currentDate || "N/A");
    // html = html.replace("{numberofpages}", "N/A");
    html = html.replace("{report_id}", intelData.report_id || "N/A");
    html = html.replace("{report_id}", intelData.report_id || "N/A");
    html = html.replace("{case_id}", intelData.case_id || "N/A");
    html = html.replace("{case_id}", intelData.case_id || "N/A");
    html = html.replace("{report_id_footer}", intelData.report_id || "N/A");
    html = html.replace("{case_id_footer}", intelData.case_id || "N/A");
    // report_type
    switch (intelData.category) {
        case 1:
            html = html.replace("{report_type}", "Tip");
            break;
        case 2:
            html = html.replace("{report_type}", "Non-Emergency");
            break;
        case 3:
            html = html.replace("{report_type}", "Emergency");
            break;
        case 4:
            html = html.replace("{report_type}", "Live Video");
            break;
        case 5:
            html = html.replace("{report_type}", "BOLO Tip");
            break;
        case 6:
            html = html.replace("{report_type}", "SMS Intel");
            break;
        case 7:
            html = html.replace("{report_type}", "Staff Assist");
            break;
        case 8:
            html = html.replace("{report_type}", "Incident");
            break;
        case 9:
            html = html.replace("{report_type}", "SaferWalk Alarm");
            break; 
        case 12:
            html = html.replace("{report_type}", "APLR");
            break; 
    }
    var SubmittedDateShow = 'N/A';
   
    if(intelData.submitter_location!=undefined && intelData.submitter_location!=''){
        if(intelData.submitter_location.created_datetime){
            SubmittedDateShow = moment(intelData.submitter_location.created_datetime*1000).tz('America/New_York').format('LTS ##*## MM/DD/YYYY');//+" EST";
        } else {
            SubmittedDateShow = moment(intelData.create_datetime*1000).tz('America/New_York').format('LTS ##*## MM/DD/YYYY');//+" EST";
        }
        //html = html.replace("{deigital_button_activated}", SubmittedDateShow || "N/A");
    }
    SubmittedDateShow = SubmittedDateShow.replace("##*##","EST")
   
    // if(intelData.submitter_location!=undefined && intelData.submitter_location!=''){
    //     html = html.replace("{physical_button_activated}", intelData.submitter_location.created_datetime || "N/A");
    // }
    if(intelData.is_desktop == true) { 
        html = html.replace("{button_activated_at}", "<li><label>Desktop Panic Button Activated at: </label> "+SubmittedDateShow+" </li>");        
        // SaferWatch Desktop Panic Button
     } else if(intelData.flick_action != undefined && intelData.flick_action != null && intelData.flick_action != ""){ 
         if(intelData.button_type == "mobilehelp"){ 
            html = html.replace("{button_activated_at}", "<li><label>SaferWatch LTE Panic Button Activated at: </label> "+SubmittedDateShow+": Hold Down </li>");    
            // SaferWatch LTE Panic Button - Hold Down
         } else if(intelData.flick_action == 1){ 
            html = html.replace("{button_activated_at}", "<li><label>Physical Button Activated at: </label> "+SubmittedDateShow+": Five Clicks </li>");    
            // SaferWatch Physical Panic Button - Five Clicks
         } else if(intelData.flick_action == 2){ 
            html = html.replace("{button_activated_at}", "<li><label>Physical Button Activated at: </label> "+SubmittedDateShow+": Hold Down </li>");    
            //  SaferWatch Physical Panic Button - Hold Down
         } else if(intelData.flick_action == 3){ 
            html = html.replace("{button_activated_at}", "<li><label>Physical Button Activated at: </label> "+SubmittedDateShow+": Three Clicks </li>");    
            //  SaferWatch Physical Panic Button - Three Clicks
         } else if(intelData.flick_action == 4){ 
            html = html.replace("{button_activated_at}", "<li><label>Physical Button Activated at: </label> "+SubmittedDateShow+": One Click </li>");    
            //  SaferWatch Physical Panic Button - One Click
         } else if(intelData.flick_action == 0){ 
            html = html.replace("{button_activated_at}", "<li><label>Digital Button Activated at: </label> "+SubmittedDateShow+" </li>");    
            // SaferWatch Mobile Panic Button
         } 
     } else { 
        html = html.replace("{button_activated_at}", "<li><label>Digital Button Activated at: </label> "+SubmittedDateShow+" </li>");    
        // SaferWatch Mobile Panic Button
     }
    var latitudeS = intelData.submitter_location.latitude;
    var longitudeS = intelData.submitter_location.longitude;
    if (latitudeS != undefined && latitudeS != null && latitudeS != "") {
        latitudeS = latitudeS.toFixed(4)
    } else {
        latitudeS = ""
    }
    if (longitudeS != undefined && longitudeS != null && longitudeS != "") {
        longitudeS = longitudeS.toFixed(4)
    } else {
        longitudeS = ""
    } 
    if(intelData.submitter_location!=undefined && intelData.submitter_location!=''){
        html = html.replace("{submitted_location}", intelData.submitter_location.address+" ( "+latitudeS+", "+longitudeS+" )");
    }else{
        html = html.replace("{submitted_location}", "N/A");
    }
    if((intelData.is_desktop==undefined || intelData.is_desktop==false) && intelData.cancellation_location!=undefined && intelData.cancellation_location!=''){
        var latitudeS = intelData.cancellation_location.latitude;
        var longitudeS = intelData.cancellation_location.longitude;
        if (latitudeS != undefined && latitudeS != null && latitudeS != "") {
            latitudeS = latitudeS.toFixed(4)
        } else {
            latitudeS = ""
        }
        if (longitudeS != undefined && longitudeS != null && longitudeS != "") {
            longitudeS = longitudeS.toFixed(4)
        } else {
            longitudeS = ""
        } 
        // var lastKnown = '<li style="font-size: 13px;"><label style="color:#808080;">Last Known Location:</label>'+intelData.cancellation_location.address+' ( '+latitudeS+', '+longitudeS+' )</li>';
        // html = html.replace("{last_known_location}",lastKnown);
    }else if((intelData.is_desktop==undefined || intelData.is_desktop==false) && intelData.user_location!=undefined && intelData.user_location!=''){
        var latitudeS = intelData.user_location.latitude;
        var longitudeS = intelData.user_location.longitude;
        if (latitudeS != undefined && latitudeS != null && latitudeS != "") {
            latitudeS = latitudeS.toFixed(4)
        } else {
            latitudeS = ""
        }
        if (longitudeS != undefined && longitudeS != null && longitudeS != "") {
            longitudeS = longitudeS.toFixed(4)
        } else {
            longitudeS = ""
        } 
        // var lastKnown = '<li style="font-size: 13px;"><label style="color:#808080;">Last Known Location:</label>'+intelData.user_location.address+' ( '+latitudeS+', '+longitudeS+' )</li>';
        // html = html.replace("{last_known_location}", lastKnown);
    }else{
        //html = html.replace("{last_known_location}", " ");
    }
    if(intelData.is_cancelled!=undefined && intelData.is_cancelled==true){
        html = html.replace("{is_ongoing}", "");
    }else{
        html = html.replace("{is_ongoing}", "(Ongoing)");
    }

    if(intelData.submitter!=undefined && intelData.submitter!='' && intelData.submitter.first_name!=undefined){
        html = html.replace("{submitter_first_name}", intelData.submitter.first_name || "N/A");
    }
    if(intelData.submitter!=undefined && intelData.submitter!='' && intelData.submitter.last_name!=undefined){
        html = html.replace("{submitter_last_name}", intelData.submitter.last_name || "N/A");
    }
    var submitterName = "";
    if (intelData.submitter != undefined && intelData.submitter.first_name != undefined && intelData.submitter.first_name != "") {
        submitterName = intelData.submitter.first_name;
        if (intelData.submitter.last_name != undefined && intelData.submitter.last_name != "") {
            submitterName += " " + intelData.submitter.last_name;
        }
    }
    html = html.replace("{incident_reported_by}", submitterName || "N/A");
    
    if(intelData.submitter!=undefined && intelData.submitter!='' && intelData.submitter.email_id!=undefined){
        html = html.replace("{submitter_email}", intelData.submitter.email_id || "N/A");
    }
    if(intelData.submitter!=undefined && intelData.submitter!='' && intelData.submitter.phone_number!=undefined){
        var cleaned = ('' + intelData.submitter.phone_number).replace(/\D/g, '')
        var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
        if (match) {
            var intlCode = (intelData.submitter.country_code ? intelData.submitter.country_code+' ' : '+1 ')
            intelData.submitter.phone_number = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
        }
        html = html.replace("{submitter_mobile_phone}", intelData.submitter.phone_number);
    }else{
        html = html.replace("{submitter_mobile_phone}", "N/A");
    }
    var contactPreference = "N/A"
    if (intelData.contact_preference!=undefined && intelData.contact_preference==1) {
        contactPreference = 'Phone Call Requested';
    } 
    if (intelData.contact_preference!=undefined && intelData.contact_preference==2) {
        contactPreference = 'Text Message Only';
    } 
    if (intelData.contact_preference!=undefined && intelData.contact_preference==3) {
        contactPreference = 'Do not contact';
    } 
    html = html.replace("{submitter_phone_call_requested_message_only}", contactPreference);
    if(intelData.cancellation_location!=undefined && intelData.cancellation_location!=''){
        var canclledDateShow = moment(intelData.cancellation_location.created_datetime*1000).tz('America/New_York').format('LTS ##*## MM/DD/YYYY');//+" EST";
        canclledDateShow = canclledDateShow.replace("##*##","EST");
        html = html.replace("{time_of_cancellation}", canclledDateShow);
    }else if(intelData.cancellation_datetime!=undefined && intelData.cancellation_datetime!=''){
        var canclledDateShow = moment(intelData.cancellation_datetime*1000).tz('America/New_York').format('LTS ##*## MM/DD/YYYY');//+" EST";
        canclledDateShow = canclledDateShow.replace("##*##","EST");
        html = html.replace("{time_of_cancellation}", canclledDateShow);
    }else{  
        html = html.replace("{time_of_cancellation}", "N/A");
    }
    if(intelData.is_cancelled!=undefined && intelData.is_cancelled && intelData.cancellation_by_reporter!=undefined && intelData.cancellation_by_reporter){
        html = html.replace("{who_cacelled_first_name}", intelData.submitter.first_name);
        html = html.replace("{who_cacelled_last_name}", intelData.submitter.last_name);
    }else if(intelData.is_cancelled!=undefined && intelData.is_cancelled && cancelledByFirstName!=undefined && cancelledByLastName!=undefined && cancelledByFirstName!='' && cancelledByLastName!='' && (intelData.cancellation_by_reporter==undefined || intelData.cancellation_by_reporter==false) ){
        html = html.replace("{who_cacelled_first_name}", cancelledByFirstName);
        html = html.replace("{who_cacelled_last_name}", cancelledByLastName);
    }else{
        html = html.replace("{who_cacelled_first_name}", "N/A");
        html = html.replace("{who_cacelled_last_name}", "");
    }
    if(reasonForCancellation!=undefined && reasonForCancellation!=''){
        html = html.replace("{reason_for_cancellation}", reasonForCancellation);
    }else{
        html = html.replace("{reason_for_cancellation}", "N/A");
    }
    // if(intelData.cancellation_location!=undefined && intelData.cancellation_location.address!=''){
    //     html = html.replace("{cancelled_last_known_address}", intelData.cancellation_location.address);
    // }else if(intelData.is_cancelled!=undefined && intelData.is_cancelled==true && intelData.user_location!=undefined && intelData.user_location!=''){
    //     html = html.replace("{cancelled_last_known_address}", intelData.user_location.address);
    // }else{
    //     html = html.replace("{cancelled_last_known_address}", "N/A");
    // }
    if(intelData.cancellation_location!=undefined && intelData.cancellation_location!=''){
        var latitudeS = intelData.cancellation_location.latitude;
        var longitudeS = intelData.cancellation_location.longitude;
        if (latitudeS != undefined && latitudeS != null && latitudeS != "") {
            latitudeS = latitudeS.toFixed(8)
        } else {
            latitudeS = ""
        }
        if (longitudeS != undefined && longitudeS != null && longitudeS != "") {
            longitudeS = longitudeS.toFixed(8)
        } else {
            longitudeS = ""
        } 
        html = html.replace("{cancelled_last_known_address}", latitudeS+", "+longitudeS );
    }else if(intelData.is_cancelled!=undefined && intelData.is_cancelled==true && intelData.user_location!=undefined && intelData.user_location!=''){
        var latitudeS = intelData.user_location.latitude;
        var longitudeS = intelData.user_location.longitude;
        if (latitudeS != undefined && latitudeS != null && latitudeS != "") {
            latitudeS = latitudeS.toFixed(8)
        } else {
            latitudeS = ""
        }
        if (longitudeS != undefined && longitudeS != null && longitudeS != "") {
            longitudeS = longitudeS.toFixed(8)
        } else {
            longitudeS = ""
        } 
        html = html.replace("{cancelled_last_known_address}", latitudeS+", "+longitudeS);
    }else{
        html = html.replace("{cancelled_last_known_address}", "N/A");
    }

    
    // incident_type
    if (intelData.category == 5) {
        html = html.replace("{incident_type}", intelData.alert_data.alert_type.title + " Alert" || "N/A");
    } else {
        html = html.replace("{incident_type}", intelData.incident.title || "N/A");
    }
    // location_name
    if (intelData.incident_commander !=undefined && intelData.claimed!=undefined && intelData.claimed==true) {
        if(intelData.incident_commander.region_name !=undefined){
            html = html.replace("{claimed_organization_name}", intelData.incident_commander.region_name);
        }else if(intelData.incident_commander.location_name !=undefined){
            html = html.replace("{claimed_organization_name}", intelData.incident_commander.location_name);
        }else if(intelData.incident_commander.organization_name !=undefined){
            html = html.replace("{claimed_organization_name}", intelData.incident_commander.organization_name);
        }else if(intelData.organization_name!=undefined){
            html = html.replace("{claimed_organization_name}", intelData.organization_name);
        }        
    } else {
        html = html.replace("{claimed_organization_name}", "N/A");
    } 

    if (intelData.claimed!=undefined && intelData.claimed==true && intelData.incident_commander !=undefined && intelData.incident_commander.first_name!=undefined && intelData.incident_commander.last_name!=undefined ) {
        html = html.replace("{claimed_by}", intelData.incident_commander.first_name+' '+intelData.incident_commander.last_name);
    } else {
        html = html.replace("{claimed_by}", "N/A");
    }
    if (intelData.claimed!=undefined && intelData.claimed==true && intelData.mark_recieved_datetime!=undefined && intelData.mark_recieved_datetime!='') {
        var markRecievedDatetime = moment(intelData.mark_recieved_datetime*1000).tz('America/New_York').format('LTS ##*## MM/DD/YYYY');//+" EST";
        markRecievedDatetime = markRecievedDatetime.replace("##*##","EST");
        html = html.replace("{claimed_on}", markRecievedDatetime);
    } else {
        html = html.replace("{claimed_on}", "N/A");
    }    

    var date = new Date(intelData.create_datetime * 1000);
    var incidentLocation = "N/A";
    if (intelData.incident_geofence != undefined && intelData.incident_geofence.address != undefined && intelData.incident_geofence.address != "") {
        incidentLocation = intelData.incident_geofence.address || "";
        incidentLocation = ((intelData.incident_geofence.radius != undefined && intelData.incident_geofence.radius != 0) ? intelData.incident_geofence.radius + " ft from " : "") + incidentLocation;
        incidentLocation = incidentLocation.toString()//.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    } else {
        incidentLocation = "Unknown Address Selected";
    }
    html = html.replace("{incident_location}", incidentLocation);
    html = html.replace("{incident_description}", intelData.alert_description || "N/A");
    var incidentDate = "N/A";
    var inDTime = "";
    switch (intelData.incident_datetime_type) {
        case 1:
        case "1":
            incidentDate = "Happening Now ";
            inDTime = moment(intelData.create_datetime, 'X').tz('America/New_York').format('MM-DD-YYYY LTS')+" EST"
            break;
        case 2:
        case "2":
            incidentDate = "Has Happened ";
            if (intelData.incident_datetime != undefined && intelData.incident_datetime != "") {
                inDTime = moment(intelData.incident_datetime).format('MM-DD-YYYY LTS')+" EST"
            }
            break;
        case 3:
        case "3":
            incidentDate = "Going to Happen ";
            if (intelData.incident_datetime != undefined && intelData.incident_datetime != "") {
                inDTime = moment(intelData.incident_datetime).format('MM-DD-YYYY LTS')+" EST"
            }
            break;
    }
    incidentDate += inDTime;
    html = html.replace("{incident_datetime}", incidentDate);
    html = html.replace("{timeline_description}", intelData.timeline_description || "")

    var intelMedia = "";
    if (!Array.isArray(intelData.media)) {
        intelData.media = [];
    }
    if (includeMedia == 0) { //when include media checkbox is not checked
        intelMedia += '<br />Contact Sender for Media Files';
    } else if (includeMedia == 2) { //when there is no media
        intelMedia += '<br />No Media Files Submitted';
    } else { // when checkbox for include media is checked
        intelMedia += '<ul>';
        // images
        var intelImages = intelData.media.filter(e => {
            return e.type == 1;
        })
        if (intelImages != undefined && intelImages.length > 0) {
            intelMedia += '<li>' + intelImages.length + ' Image(s)</br>';
            for (const el of intelImages) {
                var imageFile = process.env.MEDIA_HOST + el.s3key;
                var imgData = await new Promise((res, rej) => {
                    request.get(imageFile, function (error, response, body) {
                        if (!error && response.statusCode == 200) {
                            data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
                            res(data)
                        } else {
                            res(imageFile)
                        }
                    });
                })
                intelMedia += '<div style="page-break-before: always; page-break-after: always; width:auto;height:auto;max-width:100%;max-height:580px; text-align: center; margin-left: -40px;"><a href="' + imageFile + '" target="_blank" style="width:auto;height:auto;max-width:100%;max-height:580px;"><img src="' + imgData + '" style="width:auto;height:auto;max-width:100%;max-height:580px;"></a></div>';
            }
            intelMedia += '</li>'
        } else {
            intelMedia += '<li>0 Image(s)</li>';
        }
        // videos
        var intelVideos = intelData.media.filter(e => {
            return e.type == 2;
        });
        if (intelVideos != undefined && intelVideos.length > 0) {
            intelMedia += '<li>' + intelVideos.length + ' Video File(s)<ul>';
            intelVideos.forEach(el => {
                intelMedia += '<li><a target="_blank" href="' + process.env.MEDIA_HOST + el.s3key + '" target="_blank">' + el.s3key + '</a></li>';
            })
            intelMedia += '</ul></li>';
        } else {
            intelMedia += '<li>0 Video File(s)</li>';
        }
        // audios
        var intelAudios = intelData.media.filter(e => {
            return e.type == 3;
        });
        if (intelAudios != undefined && intelAudios.length > 0) {
            intelMedia += '<li>' + intelAudios.length + ' Audio File(s)<ul>';
            intelAudios.forEach(el => {
                intelMedia += '<li><a target="_blank" href="' + process.env.MEDIA_HOST + el.s3key + '" target="_blank">' + el.s3key + '</a></li>';
            })
            intelMedia += '</ul></li>';
        } else {
            intelMedia += '<li>0 Audio File(s)</li>';
        }
        intelMedia += '</ul>';
        if (intelImages == undefined && intelVideos == undefined && intelAudios == undefined) {
            intelMedia = "<br />No Media Files Submitted";
        }
    }
    html = html.replace("{media}", intelMedia);
    // individual description
    var individualInfo = "";
    if (Array.isArray(intelData.individuals_info) && intelData.individuals_info.length > 0) {
        for (let loopIndex = 0; loopIndex < intelData.individuals_info.length; loopIndex++) {
            const individualPersonInfo = intelData.individuals_info[loopIndex].person_info;
            individualInfo += '<tr><td style="padding-top:20px; color:#000;"><label class="indivisualIdHeading" style="font-size: 15px;"><u>INDIVIDUAL DESCRIPTION #' + (loopIndex + 1) + '</u></label><ul>';
            if (individualPersonInfo.gender != undefined && individualPersonInfo.gender != "") {
                if (individualPersonInfo.gender == 1) {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> Male</li>';
                } else if (individualPersonInfo.gender == 2) {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> Female</li>';
                } else {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> N/A</li>';
                }
            } else {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Gender:</label> N/A</li>';
            }
            if (individualPersonInfo.ethnicity_id != undefined && individualPersonInfo.ethnicity_id != "") {
                individualInfo += ' <li style="font-size:13px;"><label style="color:#808080;">Ethnicity:</label> ' + individualPersonInfo.ethnicity_id + '</li>';
            } else {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Ethnicity:</label> N/A</li>';
            }
            if (individualPersonInfo.age != undefined && individualPersonInfo.age != "") {
                if (individualPersonInfo.age.age != undefined && individualPersonInfo.age.age != "") {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> ' + individualPersonInfo.age.age + 'yrs</li>';
                } else if (individualPersonInfo.age.range_start != undefined && individualPersonInfo.age.range_start != "" && individualPersonInfo.age.range_end != undefined && individualPersonInfo.age.range_end != "") {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> ' + individualPersonInfo.age.range_start + '-' + individualPersonInfo.age.range_end + ' yrs</li>';
                } else {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Age:</label> N/A</li>';
                }
            }
            var hairs = '';
            if (individualPersonInfo.hair_color_id != undefined && individualPersonInfo.hair_color_id != "") {
                hairs += '<li style="font-size:13px;"> <label style="color:#808080;">Hair Color:</label> ' + individualPersonInfo.hair_color_id + ' {hair_type} </li>';
                if (individualPersonInfo.hair_type_id != undefined) {
                    hairs = hairs.replace('{hair_type}', '<label style="color:#808080;">Hair Type: </label> ' + individualPersonInfo.hair_type_id || "N/A");
                } else {
                    hairs = hairs.replace('{hair_type}', '<label style="color:#808080;">Hair Type:</label> N/A');
                }
            }
            individualInfo += hairs;
            if (individualPersonInfo.height != undefined) {
                if (individualPersonInfo.height.height != undefined && individualPersonInfo.height.height != "") {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> ' + individualPersonInfo.height.height + 'ft</li>';
                } else if (individualPersonInfo.height.range_start != undefined && individualPersonInfo.height.range_start != "" && individualPersonInfo.height.range_end != undefined && individualPersonInfo.height.range_end != "") {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> ' + individualPersonInfo.height.range_start + '-' + individualPersonInfo.height.range_end + ' ft</li>';
                } else {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> N/A</li>';
                }
            } else {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Height:</label> N/A</li>';
            }
            if (individualPersonInfo.weight != undefined && individualPersonInfo.weight != "") {
                if (individualPersonInfo.weight.weight != undefined && individualPersonInfo.weight.weight != "") {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> ' + individualPersonInfo.weight.weight + ' Lbs</li>';
                } else if (individualPersonInfo.weight.range_start != undefined && individualPersonInfo.weight.range_start != "" && individualPersonInfo.weight.range_end != undefined && individualPersonInfo.weight.range_end != "") {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> ' + individualPersonInfo.weight.range_start + '-' + individualPersonInfo.weight.range_end + ' Lbs</li>';
                } else {
                    individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> N/A</li>';
                }
            } else {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Weight:</label> N/A</li>';
            }
            if (individualPersonInfo.name != undefined && individualPersonInfo.name != '') {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Name:</label> ' + individualPersonInfo.name + '</li>';
            } else {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Name:</label> N/A</li>';
            }
            if (individualPersonInfo.nickname != undefined && individualPersonInfo.nickname != '') {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Nickname:</label> ' + individualPersonInfo.nickname + '</li>';
            } else {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Nickname:</label> N/A</li>';
            }
            if (individualPersonInfo.eye_color_id != undefined && individualPersonInfo.eye_color_id != '') {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Eye Color:</label> ' + individualPersonInfo.eye_color_id + '</li>';
            } else {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Eye Color:</label> N/A</li>';
            }
            if (individualPersonInfo.facial_hair_id != undefined && individualPersonInfo.facial_hair_id != '') {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Facial Hair:</label> ' + individualPersonInfo.facial_hair_id + '</li>';
            } else {
                individualInfo += '<li style="font-size:13px;"> <label style="color:#808080;">Facial Hair:</label> N/A</li>';
            }

            var hats = '<li style="font-size:13px;"> <label style="color:#808080;">Hat Color:</label> {hat_color_id} <label style="color:#808080;">Hat Type:</label> {hat_id}';
            if (individualPersonInfo.hat_color_id != undefined && individualPersonInfo.hat_color_id != '') {
                hats = hats.replace('{hat_color_id}', individualPersonInfo.hat_color_id);
            } else {
                hats = hats.replace('{hat_color_id}', "N/A");
            }
            if (individualPersonInfo.hat_id != undefined && individualPersonInfo.hat_id != '') {
                hats = hats.replace('{hat_id}', individualPersonInfo.hat_id);
            } else {
                hats = hats.replace('{hat_id}', "N/A");
            }
            individualInfo += hats;

            var shirts = '<li style="font-size:13px;"> <label style="color:#808080;">Shirt Color:</label> {shirt_color_id} <label style="color:#808080;">Shirt Type:</label> {shirt_type_id} </li>';
            if (individualPersonInfo.shirt_color_id != undefined && individualPersonInfo.shirt_color_id != "") {
                shirts = shirts.replace('{shirt_color_id}', individualPersonInfo.shirt_color_id);
            } else {
                shirts = shirts.replace('{shirt_color_id}', 'N/A');
            }
            if (individualPersonInfo.shirt_type_id != undefined && individualPersonInfo.shirt_type_id != '') {
                shirts = shirts.replace('{shirt_type_id}', individualPersonInfo.shirt_type_id);
            } else {
                shirts = shirts.replace('{shirt_type_id}', "N/A");
            }
            individualInfo += shirts;

            var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Pant Color:</label> {pants_color_id} <label style="color:#808080;">Pant Type:</label> {pants_type_id} </li>';
            if (individualPersonInfo.pants_color_id != undefined && individualPersonInfo.pants_color_id != "") {
                obj = obj.replace('{pants_color_id}', individualPersonInfo.pants_color_id);
            } else {
                obj = obj.replace('{pants_color_id}', 'N/A');
            }
            if (individualPersonInfo.pants_type_id != undefined && individualPersonInfo.pants_type_id != '') {
                obj = obj.replace('{pants_type_id}', individualPersonInfo.pants_type_id);
            } else {
                obj = obj.replace('{pants_type_id}', "N/A");
            }
            individualInfo += obj;

            var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Dress Color:</label> {dress_color_id} <label style="color:#808080;">Dress Type:</label> {dress_type_id} </li>';
            if (individualPersonInfo.dress_color_id != undefined && individualPersonInfo.dress_color_id != "") {
                obj = obj.replace('{dress_color_id}', individualPersonInfo.dress_color_id);
            } else {
                obj = obj.replace('{dress_color_id}', 'N/A');
            }
            if (individualPersonInfo.dress_type_id != undefined && individualPersonInfo.dress_type_id != '') {
                obj = obj.replace('{dress_type_id}', individualPersonInfo.dress_type_id);
            } else {
                obj = obj.replace('{dress_type_id}', "N/A");
            }
            individualInfo += obj;

            var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Outwear Color:</label> {outerwear_color_id} <label style="color:#808080;">Outwear Type:</label> {outerwear_type_id} </li>';
            if (individualPersonInfo.outerwear_color_id != undefined && individualPersonInfo.outerwear_color_id != "") {
                obj = obj.replace('{outerwear_color_id}', individualPersonInfo.outerwear_color_id);
            } else {
                obj = obj.replace('{outerwear_color_id}', 'N/A');
            }
            if (individualPersonInfo.outerwear_type_id != undefined && individualPersonInfo.outerwear_type_id != '') {
                obj = obj.replace('{outerwear_type_id}', individualPersonInfo.outerwear_type_id);
            } else {
                obj = obj.replace('{outerwear_type_id}', "N/A");
            }
            individualInfo += obj;

            var obj = '<li style="font-size:13px;"> <label style="color:#808080;">Shoe Color:</label> {shoe_color_id} <label style="color:#808080;">Shoe Type:</label> {shoe_type_id} </li>';
            if (individualPersonInfo.shoe_color_id != undefined && individualPersonInfo.shoe_color_id != "") {
                obj = obj.replace('{shoe_color_id}', individualPersonInfo.shoe_color_id);
            } else {
                obj = obj.replace('{shoe_color_id}', 'N/A');
            }
            if (individualPersonInfo.shoe_type_id != undefined && individualPersonInfo.shoe_type_id != '') {
                obj = obj.replace('{shoe_type_id}', individualPersonInfo.shoe_type_id);
            } else {
                obj = obj.replace('{shoe_type_id}', "N/A");
            }
            individualInfo += obj;

            individualInfo += '</ul> </td> </tr>';
        }
    }
    html = html.replace('{individualInfo}', individualInfo);
    if (intelData.additional_information != undefined) {
        if ((intelData.additional_information.name == undefined || intelData.additional_information.name == null || intelData.additional_information.name == "") && (intelData.additional_information.phone_number == undefined || intelData.additional_information.phone_number == null || intelData.additional_information.phone_number == "") && (intelData.additional_information.email == undefined || intelData.additional_information.email == null || intelData.additional_information.email == "") && (intelData.additional_information.relationship_title == undefined || intelData.additional_information.relationship_title == null || intelData.additional_information.relationship_title == "") && (intelData.additional_information.address == undefined || intelData.additional_information.address == null || intelData.additional_information.address == "")) {
            html = html.replace('{person_with_more_information}', "");
            html = html.replace('{additional_information_name}', "");
            html = html.replace('{additional_information_phone_number}', "");
            html = html.replace('{additional_information_email}', "");
            html = html.replace('{additional_information_relation}', "");
            if (intelData.additional_information.address != undefined && typeof intelData.additional_information.address == "string" && intelData.additional_information.address.length > 0) {
                html = html.replace('{additional_information_address}', "");
            } else if (intelData.additional_information.address != undefined && intelData.additional_information.address.address != undefined && typeof intelData.additional_information.address.address == "string" && intelData.additional_information.address.address.length > 0) {
                html = html.replace('{additional_information_address}', "");
            } else {
                html = html.replace('{additional_information_address}', "");
            }
            html = html.replace('{name}', "");
            html = html.replace('{phone}', "");
            html = html.replace('{email_address}', "");
            html = html.replace('{relation}', "");
            html = html.replace('{address}', "");
            html = html.replace('{style}', ' <td style="display:none;padding-top:20px; color:#000;">')
            html = html.replace('{styleclose}', "</td>")
        } else {
            html = html.replace('{person_with_more_information}', "PERSON WITH MORE INFORMATION");
            html = html.replace('{additional_information_name}', intelData.additional_information.name || "N/A");
            html = html.replace('{additional_information_phone_number}', intelData.additional_information.phone_number || "N/A");
            html = html.replace('{additional_information_email}', intelData.additional_information.email || "N/A");
            html = html.replace('{additional_information_relation}', intelData.additional_information.relationship_title || "N/A");
            if (intelData.additional_information.address != undefined && typeof intelData.additional_information.address == "string" && intelData.additional_information.address.length > 0) {
                html = html.replace('{additional_information_address}', intelData.additional_information.address);
            } else if (intelData.additional_information.address != undefined && intelData.additional_information.address.address != undefined && typeof intelData.additional_information.address.address == "string" && intelData.additional_information.address.address.length > 0) {
                html = html.replace('{additional_information_address}', intelData.additional_information.address.address);
            } else {
                html = html.replace('{additional_information_address}', "N/A");
            }
            html = html.replace('{name}', "Name");
            html = html.replace('{phone}', "Phone");
            html = html.replace('{email_address}', "Email Address");
            html = html.replace('{relation}', "Relation");
            html = html.replace('{address}', "Address");
            html = html.replace('{style}', ' <td style="display:block;padding-top:20px; color:#000;">')
            html = html.replace('{styleclose}', "</td>")
        }
        if (intelData.additional_information.other_description != undefined && intelData.additional_information.other_description != null && intelData.additional_information.other_description != "") {
            html = html.replace('{additional_information_other_description_head}', "ADDITIONAL INFORMATION");
            html = html.replace('{additional_information_other_description_headd}', "ADDITIONAL INFORMATION: ");
            html = html.replace('{additional_information_other_description}', intelData.additional_information.other_description);
        } else {
            html = html.replace('{additional_information_other_description_head}', "")
            html = html.replace('{additional_information_other_description_headd}', "");;
            html = html.replace('{additional_information_other_description}', "");
        }
    } else {
        html = html.replace('{additional_information_name}', "N/A");
        html = html.replace('{additional_information_phone_number}', "N/A");
        html = html.replace('{additional_information_email}', "N/A");
        html = html.replace('{additional_information_relation}', "N/A");
        html = html.replace('{additional_information_other_description}', "N/A");
        html = html.replace('{additional_information_address}', "N/A");
    }
    // var contactPrefHtml = ''
    // if (disableContactPreference == true) {

    // } else {
    //     contactPrefHtml = '<tr><td style="padding-top:20px; color:#000;"><label style="font-size: 15px;"><u>CONTACT PREFERENCE</u></label><br /><label style="font-size:13px; color:#808080;">Contact for Further Information:</label><label style="font-size:13px;"> {do_not_contact} </label><label style="font-size:13px;"> {contact_preference} </label></td></tr>'
    //     var contactPreference = '';
    //     if (intelData.do_not_contact == true) {
    //         contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "No")
    //     } else {
    //         contactPreference += '<label>';
    //         contactPreference += '<ul>';
    //         contactPreference += '<li style="font-size: 13px;">';
    //         contactPreference += '<label style="color:#808080;">Submitter: </label>';
    //         if (intelData.anonymous == true) {
    //             contactPreference += 'Anonymous';
    //         } else {
    //             contactPreference += intelData.submitter.first_name + ' ' + intelData.submitter.last_name;
    //         }

    //         contactPreference += '</li>';
    //         contactPreference += '<li style="font-size: 13px;">';

    //         var cleaned = ('' + intelData.submitter.phone_number).replace(/\D/g, '')
    //         var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
    //         if (match) {
    //             var intlCode = (match[1] ? '+1 ' : '')
    //             intelData.submitter.phone_number = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
    //         }
    //         contactPreference += '<label style="color:#808080;">Phone: </label>' + intelData.submitter.country_code + "- " + intelData.submitter.phone_number + '</li>';
    //         contactPreference += '</ul>';
    //         contactPreference += '</label>';
    //         contactPrefHtml = contactPrefHtml.replace("{do_not_contact}", "Yes")
    //     }
    //     contactPrefHtml = contactPrefHtml.replace("{contact_preference}", contactPreference);
    // }
    //html = html.replace("{send_contact_preference}", contactPrefHtml)
    html = html.replace("{alert_description}", intelData.alert_description || "N/A");
    html = html.replace(/ :/g,":");
    //#endregion html template
    var intelReportFileName = intelData.report_id + '-summary.pdf';
    if(isFullReport){
        intelReportFileName = intelData.report_id + '-full.pdf';
    }
    var pdfreport = new Promise(function (resolve, reject) {
        pdf.create(html, options).toFile('./tmp/' + intelReportFileName, function (err, buff) {
            if (err) {
                console.error(err)
                reject(false)
            } else {
                resolve(true)
            }
        })
    })
    
    resl(pdfreport)
}

function getEmgTimeLineHtml(timeLineObj, reporterFirstName, reporterLastName){
    var showmap = ""
    if (timeLineObj.incident_geofence != undefined && 
        timeLineObj.previous_incident_geofence != undefined && 
        timeLineObj.action != 3 && 
        timeLineObj.action != 4 && 
        timeLineObj.action != 5) {
        showmap = true;
    } else {
        showmap = false;
    }
    var timeLineHtml = '';
    var locationSharingBase = process.env.LOCATION_SHARING_BASE;
    var mediaUploadBase = process.env.MEDIA_UPLOAD_BASE;
    var liveVideoBase = process.env.LIVE_VIDEO_BASE;
    var mediaHost = process.env.MEDIA_HOST;
    const statusMatrix = {
        0: "Unassigned",
        1: "Verifying",
        // 2: "Verified",
        // 3: "Unable to Confirm",
        // 4: "False",
        5: "Reported",
        // 6: "Resolved",
        7: "Assigned",
        8: "Forwarded",
        9: "Under Investigation",
        10: "Closed",
        11: "Canceled"
    }
    timeLineHtml += "<div class='col-12 col-sm-10 col-md-10 col-lg-10 col-xl-11' style='max-width: 525px'><span class='userName-caseNotes font-weight-bold'>";
    if (timeLineObj.is_reporter == true) {
        if (reporterFirstName != undefined &&
            reporterFirstName != '') {
            timeLineHtml += reporterFirstName +
                "&nbsp;";
        }
        if (reporterLastName != undefined &&
            reporterLastName != '') {
            timeLineHtml += reporterLastName + " -- ";
        }
        timeLineHtml += "Reporter: ";
        if (timeLineObj.action == 2 && timeLineObj.alert_description != undefined) {
            timeLineHtml += '<label style="color:#808080;">Text: ' + timeLineObj.alert_description + ' </label>'
        }

        if (showmap == true) {
            timeLineHtml += '<br><ul><li><label style="color:#808080;">Address Change: ' + timeLineObj.previous_incident_geofence.address +' to ';
            if (timeLineObj.incident_geofence.radius !=
                undefined &&
                timeLineObj.incident_geofence.radius != "") {
                timeLineHtml += timeLineObj.incident_geofence.radius +
                    " ft from ";
            }

            timeLineHtml += timeLineObj.incident_geofence.address +" </label></li></ul>";
        }
    } else {
        if (timeLineObj.submitter.first_name != undefined &&
            timeLineObj.submitter
            .first_name != '') {
            timeLineHtml += timeLineObj.submitter.first_name +
                "&nbsp;";
        }
        if (timeLineObj.submitter.last_name != undefined &&
            timeLineObj.submitter
            .last_name != '') {
            timeLineHtml += timeLineObj.submitter.last_name ;
        }
        if (timeLineObj.submitter.user_role != undefined &&
            timeLineObj.submitter.user_role !=
            "" ) {
            timeLineHtml += '<span>'+ " -- " + timeLineObj.submitter.user_role + ": " + '</span>';
        }else if (timeLineObj.submitter.profile != undefined &&
            timeLineObj.submitter.profile.title !=
            undefined && timeLineObj.submitter.profile
            .title != "") {
            timeLineHtml += '<span>'+ " -- " + timeLineObj.submitter.profile.title + ": " + '</span>';
        }else{
            timeLineHtml += ": ";
        }
    }

    if (timeLineObj.is_reporter == false) {
        if (timeLineObj.action_type == 1) {

            if (timeLineObj.emails != undefined && Array
                .isArray(timeLineObj
                    .emails)) {
                if (timeLineObj.emails.length >
                    3
                ) { //show more popup for emails(when no of emails is greater than 3)
                    timeLineHtml += '<span style="font-size: 13px;">';
                    timeLineHtml +=
                        '<span>Forwarded Intel to <b>' +
                        timeLineObj.agency +
                        ' </b>: <b> ' + timeLineObj.emails.join(', ')  +
                        '</b></span>'
                    timeLineHtml += '</span>';


                } else {
                    timeLineHtml += '<span style="font-size: 13px;">';
                    timeLineHtml +=
                        '<span>Forwarded Intel to <b>' +
                        timeLineObj.agency +
                        ' </b>: <b>' + timeLineObj
                        .emails.join(', ') +
                        '</b></span>'
                    timeLineHtml += '</span>';

                }
            }
        } else if (timeLineObj.action_type == 2) {
            //timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                'Status changed from <b>' +
                statusMatrix[timeLineObj.from_status] +
                '</b> to <b>' + statusMatrix[timeLineObj.to_status] +
                '</b>'
            //timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 3) {
            timeLineHtml += '<span style="font-size: 13px;">';
            if (timeLineObj.category == 7) {
                timeLineHtml += '<span>Claimed Staff Assist Report</span>'
            }else{
                timeLineHtml += '<span>Claimed Emergency Report</span>'
            }            
            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 4) {
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                '<span>Marked Received</span>'
            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 5) {
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                '<span>Archived Intel</span>'
            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 6) {
            timeLineHtml += '<span style="font-size: 13px;">';
            if (timeLineObj.action_value == 1) {
                timeLineHtml +=
                    '<span>Updated Case ID: <b>' +
                    timeLineObj.case_id + '</b></span>'
            } else if (timeLineObj.action_value == 2) {
                timeLineHtml +=
                    '<span>Case ID Removed. <b>' +
                    timeLineObj.case_id + '</b></span>'
            } else {
                timeLineHtml +=
                    '<span>Added Case ID: <b>' +
                    timeLineObj.case_id + '</b></span>'
            }

            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 7) {
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                '<span>Changed Incident Type: <b>' +
                timeLineObj.from_incident.title +
                ' </b> to <b>' + timeLineObj
                .to_incident
                .title + '</b></span>'


            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 8) {
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                '<span>Changed Reported Location from <b>' +
                timeLineObj.from_location.name +
                ' </b> to <b>' + timeLineObj
                .to_location
                .name + '</b></span>'


            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 10) {
            timeLineHtml += '<span style="font-size: 13px;">';
                if (timeLineObj.category == 7) {
                    timeLineHtml += '<span> Ended Staff Assist Report </span>'
                }else{
                    timeLineHtml += '<span> Ended Emergency Report </span>'
                } 
            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 11) {
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                "<span> Reporter's Status Changed from <b>" +
                getEmergencyStatus(timeLineObj.from_status, timeLineObj.from_reporter_status_text, timeLineObj.category) +
                " </b> to <b>" + getEmergencyStatus(timeLineObj.to_status, timeLineObj.to_reporter_status_text, timeLineObj.category) + "</b></span>"


            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 12) {
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                '<span> Reason for Ending: <b>' +
                timeLineObj.comment_text + '</b></span>'


            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 31){
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                '<span><b>Started a SMS conversation with reporter.</b></span>'
            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 38){
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml +=
                '<span><b>Initiated Phone Call to SaferWatch LTE Panic Button</b></span>'
            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 39){
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml += '<span><b>SaferWatch LTE Panic Button Call Recording:</b></span><ul>'
            for (const media of timeLineObj.media) {
                timeLineHtml += '<li><a href="' + mediaHost + media.media_key + '" target="_blank">' + mediaHost + media.media_key + '</a></li>';    
            }
            timeLineHtml += '</ul></span>';
        } else if (timeLineObj.action_type == 50){
            const lp = timeLineObj.lp || "N/A";
            const camera = timeLineObj.camera_id;
            timeLineHtml += '<span style="font-size: 13px;">';
            if (camera && camera !== "N/A") {
                timeLineHtml += `<span><b>LP ${lp} was detected from Camera ${camera}</b></span>`;
            } else {
                timeLineHtml += `<span><b>LP ${lp} was detected</b></span>`;
            }
            timeLineHtml += "</span>";
        } else if (timeLineObj.action_type == 52){
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml += `<span><b>Initiated Phone Call to ${timeLineObj?.psap?.agency || "PSAP"}${timeLineObj?.psap?.phone ? ` at ${convertToUSFormat(`+1${timeLineObj?.psap?.phone}`)}` : ''}</b></span>`;
            timeLineHtml += '</span>';
        } else if (timeLineObj.action_type == 53){
            timeLineHtml += '<span style="font-size: 13px;">';
            timeLineHtml += `<span><b>${(timeLineObj.psap && timeLineObj.psap.agency) ? timeLineObj.psap.agency : 'PSAP'} Call Recording${(timeLineObj.psap && timeLineObj.psap.phone) ? ` at ${convertToUSFormat(`+1${timeLineObj?.psap?.phone}`)}` : ''}:</b></span><ul>`
            for (const media of timeLineObj.media) {
                timeLineHtml += '<li><a href="' + mediaHost + media.media_key + '" target="_blank">' + mediaHost + media.media_key + '</a></li>';    
            }
            timeLineHtml += '</ul></span>';
        } else {
            if (timeLineObj.comment_text != '' && timeLineObj.comment_text !=
                undefined) {
                timeLineHtml += "<span >" + timeLineObj
                    .comment_text + "</span>";
            }

            if (timeLineObj.media && timeLineObj.media.length != 0) {
                timeLineHtml += '<ul ><li>Media:<ul>'
                var mediaImages = '';
                var mediaVideo = '';
                var mediaAudio = '';
                var countImage = countVideo = countAudio = 0;
                for (var j = 0; j < timeLineObj.media.length; j++) {
                    if (timeLineObj.media[j].media_type == 0) { //image
                        if (countImage == 0) {
                            mediaImages = '<li >Images: <ul>';
                            countImage = 1;
                        }
                        mediaImages += '<li><a href="' + mediaHost + timeLineObj.media[j].media_key + '" target="_blank">' + mediaHost + timeLineObj.media[j].media_key + '</a></li>';

                    } else if (timeLineObj.media[j].media_type ==
                        1) { //video
                        if (countVideo == 0) {
                            mediaVideo = '<li >Video: <ul>';
                            countVideo = 1;
                        }
                        mediaVideo += '<li><a href="' + mediaHost + timeLineObj.media[j].media_key + '" target="_blank">' + mediaHost + timeLineObj.media[j].media_key + '</a></li>';

                    } else if (timeLineObj.media[j].media_type ==
                        2) { //audio
                        if (countAudio == 0) {
                            mediaAudio = '<li >Documents: <ul>';
                            countAudio = 1;
                        }
                        mediaAudio += '<li><a href="' + mediaHost + timeLineObj.media[j].media_key + '" target="_blank">' + mediaHost + timeLineObj.media[j].media_key + '</a></li>';
                    }

                }
                if (mediaImages != '') mediaImages += '</ul></li>'
                if (mediaVideo != '') mediaVideo += '</ul></li>'
                if (mediaAudio != '') mediaAudio += '</ul></li>'
                timeLineHtml += mediaImages + mediaVideo + mediaAudio;
                timeLineHtml += '</ul></li></ul>';
            }
        }
    } else {
        if (timeLineObj.action == 1) {
            timeLineHtml += '<span >';
            timeLineHtml += timeLineObj.alert_description;
            timeLineHtml += '</span>';

        } else if (timeLineObj.action == 6) {
            timeLineHtml += '<span >';
            timeLineHtml += "Reason for cancellation: " + timeLineObj.alert_description;
            timeLineHtml += '</span>';

        } else if (timeLineObj.action == 3) {
            timeLineHtml += '<span >';
            //timeLineHtml += timeLineObj.alert_description +" at "+timeLineObj.incident_geofence.address;
            timeLineHtml += timeLineObj.alert_description +" at "+ (timeLineObj.incident_geofence.latitude).toFixed(8) + ', ' + (timeLineObj.incident_geofence.longitude).toFixed(8) 
            timeLineHtml += '</span>';

        } else if (timeLineObj.action == 4 || timeLineObj
            .action == 5) {
            timeLineHtml += '<span >';
            timeLineHtml += timeLineObj.alert_description;
            timeLineHtml += '</span>';
        }
    }

    if (timeLineObj.media != undefined && Array.isArray(
            timeLineObj.media) && timeLineObj.media
        .length >
        0 && timeLineObj.is_reporter == true) {
        timeLineHtml += '<ul ><li>Media:<ul>';

        var mediaImages = '';
        var mediaVideo = '';
        var mediaAudio = '';
        var countImage = countVideo = countAudio = 0;
        for (var j = 0; j < timeLineObj.media.length; j++) {
            if (timeLineObj.media[j].type == 1) { //image
                if (countImage == 0) {
                    mediaImages = '<li >Images: <ul>';
                    countImage = 1;
                }
                mediaImages += '<li><a href="' + mediaHost + timeLineObj.media[j].s3key + '" target="_blank">' + mediaHost + timeLineObj.media[j].s3key + '</a></li>';

            } else if (timeLineObj.media[j].type ==
                2) { //video
                if (countVideo == 0) {
                    mediaVideo = '<li >Video: <ul>';
                    countVideo = 1;
                }
                mediaVideo += '<li><a href="' + mediaHost + timeLineObj.media[j].s3key + '" target="_blank">' + mediaHost + timeLineObj.media[j].s3key + '</a></li>';

            } else if (timeLineObj.media[j].type ==
                3) { //audio
                if (countAudio == 0) {
                    mediaAudio = '<li >Audio: <ul>';
                    countAudio = 1;
                }
                mediaAudio += '<li><a href="' + mediaHost + timeLineObj.media[j].s3key + '" target="_blank">' + mediaHost + timeLineObj.media[j].s3key + '</a></li>';
            }

        }
        if (mediaImages != '') mediaImages += '</ul></li>'
        if (mediaVideo != '') mediaVideo += '</ul></li>'
        if (mediaAudio != '') mediaAudio += '</ul></li>'
        timeLineHtml += mediaImages + mediaVideo + mediaAudio;
        timeLineHtml += '</ul></li></ul>';
    }
    timeLineHtml += '</span>'
    timeLineHtml += '</div>'
    return timeLineHtml;
}

function getIntelReportedMethod(val) {
    try {
        val = parseInt(val)
        if (val == 1) {
            return 'Radio';
        } else if (val == 2) {
            return 'Phone Call';
        } else if (val == 3) {
            return '911 Phone Call';
        } else if (val == 4) {
            return 'Tip Line/Hotline';
        } else if (val == 5) {
            return 'In-person Report';
        } else if (val == 6) {
            return 'Supervisor';
        } else if (val == 7) {
            return 'Website';
        } else if (val == 8) {
            return 'Mobile App';
        } else if (val == 9) {
            return 'Intel Analyst';
        } else if (val == 10) {
            return 'Security Officer';
        } else if (val == 11) {
            return 'Employee Report';
        } else if (val == 12) {
            return 'Police Radio Scanner';
        } else if (val == 13) {
            return 'Visual/Surveillance';
        } else {
            return 'N/A'
        }
    } catch (error) {
        return 'N/A'
    }
}

function incidentClassification(id) {
    switch(id){
        case 1:
        case "1":
            return `<span style="color: green;font-weight: bolder;">General</span>`
            break;
        case 2:
        case "2":
            return `<span style="color: goldenrod;font-weight: bolder;">Moderate</span>`
            break;
        case 3:
        case "3":
            return `<span style="color: orange;font-weight: bolder;">Elevated</span>`
            break;
        case 4:
        case "4":
            return `<span style="color: red;font-weight: bolder;">Severe</span>`
            break;
        default:
            return `<span style="color: #67757c;">N/A</span>`
            break;
    }
}

function getEmergencyStatus(intelStatus, intelStatusText = 'Other', category = 3) {
    if (intelStatus == 0) {
        return 'All Clear';
    } else if (intelStatus == 1) {
        if (category == 7) {
            return 'Staff Assist Has Been Resolved';
        } else {
            return 'Emergency Has Been Resolved';
        }
    } else if (intelStatus == 2) {
        return 'Evacuate';
    } else if (intelStatus == 3) {
        return 'First Responders Are On Scene';
    } else if (intelStatus == 4) {
        return 'First Responders Are On The Way';
    } else if (intelStatus == 5) {
        return 'Help Is On The Way';
    } else if (intelStatus == 6) {
        return 'Please Call 911 If Possible';
    } else if (intelStatus == 7) {
        return 'Provide Additional Details If Possible';
    } else if (intelStatus == 8) {
        return 'Report Received';
    } else if (intelStatus == 9) {
        return 'Reported';
    } else if (intelStatus == 10) {
        return 'Shelter In Place';
    } else if (intelStatus == 11) {
        return 'Trying To Locate You Now';
    } else if (intelStatus == 12) {
        return intelStatusText;
    } else if (intelStatus == 13) {
        return 'Provide Exact Location of Incident';
    }
}

function getCaseNotesHtml(caseNotesSMS, phone_number = '') {
    const locationSharingBase = process.env.LOCATION_SHARING_BASE;
    const mediaUploadBase = process.env.MEDIA_UPLOAD_BASE;
    const liveVideoBase = process.env.LIVE_VIDEO_BASE;
    const mediaHost = process.env.MEDIA_HOST;

    const statusMatrix = {
        0: "Unassigned",
        1: "Verifying",
        // 2: "Verified",
        // 3: "Unable to Confirm",
        // 4: "False",
        5: "Reported",
        // 6: "Resolved",
        7: "Assigned",
        8: "Forwarded",
        9: "Under Investigation",
        10: "Closed",
        11: "Canceled"
    }

    let caseNotesHtml = ""; //"<div class='col-12 col-sm-10 col-md-10 col-lg-10 col-xl-11' style='max-width: 525px'><div class='userName-caseNotes font-weight-bold'>";

    // ---------- Helpers ----------
    const getCallerHtml = (number) =>
        "Caller: " + ((this.isAnonymousChat === true) ? parseInt(number).toString(16) : convertToUSFormat(number));

    const renderMediaList = (title, items) => {
        let html = `<div style="font-size: 13px;"><label style="color:#808080;">Uploaded Media Files ${title}:</label><ul>`;
        items.forEach((item, idx) => {
            html += `<li style="font-size: 13px;"><label style="color:#808080;">File ${idx + 1}:</label> <a target="_blank" href="${mediaHost + item.media_key}">${mediaHost + item.media_key}</a></li>`;
        });
        html += '</ul></div>';
        return html;
    };

    const renderIconText = (icon, text, color = "text-info") =>
        `<span class="desc-caseNotes"><span class="blue-icon mr-1"><i class="${icon} font-size-fontAwesome"></i></span><span class="${color}">${text}</span></span>`;

    // ---------- Caller / Name ----------
    if (caseNotesSMS.submitter.first_name) {
        if (phone_number && phone_number.includes(caseNotesSMS.submitter.phone_number)) {
            caseNotesHtml += getCallerHtml(caseNotesSMS.from_number);
        } else {
            caseNotesHtml += caseNotesSMS.submitter.first_name;
            if (caseNotesSMS.submitter.last_name) {
                caseNotesHtml += " " + caseNotesSMS.submitter.last_name + ": ";
            }
        }
    } else if (caseNotesSMS.from_number) {
        caseNotesHtml += getCallerHtml(caseNotesSMS.from_number);
    }

    // ---------- Action Type ----------
    switch (caseNotesSMS.action_type) {
        case 0: { // Text and Media uploads
            caseNotesHtml += caseNotesSMS.comment_text;
            if (Array.isArray(caseNotesSMS.media) && caseNotesSMS.media.length > 0) {
                const imageMedia = caseNotesSMS.media.filter(m => m.media_type === 0);
                const videoMedia = caseNotesSMS.media.filter(m => m.media_type === 1);
                const docMedia = caseNotesSMS.media.filter(m => m.media_type === 2);

                if (videoMedia.length) caseNotesHtml += renderMediaList("Video", videoMedia);
                if (docMedia.length) caseNotesHtml += renderMediaList("Document", docMedia);
                if (imageMedia.length) caseNotesHtml += renderMediaList("Image", imageMedia);
            }
            break;
        }
        case 1: { // Forwarded Intel
            if (Array.isArray(caseNotesSMS.emails)) {
                caseNotesHtml += renderIconText(
                    "fal fa-share-square",
                    `Forwarded Intel to <b>${caseNotesSMS.agency}</b>: <b>${caseNotesSMS.emails.join(', ')}</b>`
                );
            }
            break;
        }
        case 2: { // Status change
            caseNotesHtml += renderIconText(
                "fal fa-sync-alt",
                `Status changed from <b>${statusMatrix[caseNotesSMS.from_status]}</b> to <b>${statusMatrix[caseNotesSMS.to_status]}</b>`
            );
            break;
        }
        case 3: { // Claimed report
            let msg = "Claimed Intel";
            if (caseNotesSMS.category === 3) msg = "Claimed Emergency Report";
            if (caseNotesSMS.category === 7) msg = "Claimed Staff Assist Report";
            if (caseNotesSMS.category === 12) msg = "Claimed ALPR Report";
            caseNotesHtml += renderIconText("fal fa-user-shield", msg);
            break;
        }
        case 4: { // Marked received
            caseNotesHtml += renderIconText("far fa-check", "Marked Received");
            break;
        }
        case 5: { // Archived Intel
            caseNotesHtml += renderIconText("fal fa-archive", "Archived Intel");
            break;
        }
        case 6: { // Case ID
            if (caseNotesSMS.action_value === 2) {
                caseNotesHtml += renderIconText("fal fa-id-badge", " Case ID Removed. ");
            } else if (caseNotesSMS.action_value === 1) {
                caseNotesHtml += renderIconText("fal fa-id-badge", ` Updated Case ID: <b>${caseNotesSMS.case_id}</b>`);
            } else {
                caseNotesHtml += renderIconText("fal fa-id-badge", ` Added Case ID: <b>${caseNotesSMS.case_id}</b>`);
            }
            break;
        }
        case 7: { // Incident type change
            if (caseNotesSMS.from_incident?.title) {
                caseNotesHtml += renderIconText("fal fa-edit",
                    `Changed Incident Type from <b>${caseNotesSMS.from_incident.title}</b> to <b>${caseNotesSMS.to_incident.title}</b>`
                );
            } else {
                caseNotesHtml += renderIconText("fal fa-edit",
                    `Configured Incident Type to <b>${caseNotesSMS.to_incident.title}</b>`
                );
            }
            break;
        }
        case 8: { // Location change
            if (caseNotesSMS.from_location?.name) {
                caseNotesHtml += renderIconText("fal fa-building",
                    `Changed the Reported Location from <b>${caseNotesSMS.from_location.name}</b> to <b>${caseNotesSMS.to_location.name}</b>`
                );
            } else {
                caseNotesHtml += renderIconText("fal fa-building",
                    `Configured Reported Location to <b>${caseNotesSMS.to_location.name}</b>`
                );
            }
            break;
        }
        case 9: { // Blank
            break;    
        }
        case 10: { // Cancelled report
            caseNotesHtml += renderIconText("fal fa-sync",
                caseNotesSMS.category === 7
                    ? "Cancelled Staff Assist Report "
                    : "Cancelled Emergency Report "
            );
            break;
        }
        case 11: { // Reporter status change
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class='aligment-icon'>
                    <div class='icon-padding pr-1'><i class='fal fa-sync font-size-fontAwesome'></i></div>
                    <div> Reporter's Status Changed from  <b>${getEmergencyStatus(caseNotesSMS.from_status, caseNotesSMS.from_reporter_status_text, caseNotesSMS.category)}</b>
                    to <b>${getEmergencyStatus(caseNotesSMS.to_status, caseNotesSMS.to_reporter_status_text, caseNotesSMS.category)}</b></div>
                </div></div>`;
            break;
        }
        case 12: { // Reason for ending
            caseNotesHtml += renderIconText("fal fa-sync", ` Reason for cancellation:  <b>${caseNotesSMS.comment_text}</b>`);
            break;
        }
        case 13: { // Live video ended
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><i class="fal fa-ban font-size-fontAwesome"></i></div>
                <div>${caseNotesSMS.submitter.first_name} ${caseNotesSMS.submitter.last_name} ended the live video</div></div></div>`;
            break;
        }
        case 14: { // Live video started
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="./images/panic-btn/physical-panic-button.png" class="pr-1 panic-btn-img"></div>
                <div>${caseNotesSMS.submitter.first_name} ${caseNotesSMS.submitter.last_name} activated Live Video at 
                ${moment.utc(caseNotesSMS.created_datetime).local().format(datetimeCapital)} on 
                ${moment.utc(caseNotesSMS.created_datetime).local().format(dateSimpleFormat)}</div></div></div>`;
            break;
        }
        case 15: { // Live video ended
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><i class="fal fa-ban font-size-fontAwesome"></i></div>
                <div>${caseNotesSMS.submitter.first_name} ${caseNotesSMS.submitter.last_name} ended Live Video </div></div></div>`;
            break;
        }
        case 16: { // Blank
            break;
        }
        case 17: { // Joined video session as operator
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1 blue-icon"><i class="fas fa-user-headset"></i></div>
                <div>${caseNotesSMS.submitter.first_name} ${caseNotesSMS.submitter.last_name} Joined video Session As The Operator</div></div></div>`;
            break;
        }
        case 18: { // Joined video session as viewer
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon" style="padding-top: 1px"><div class="icon-padding pr-1"><img src="/images/tip.png" width="18"></div>
                <div>${caseNotesSMS.submitter.first_name} ${caseNotesSMS.submitter.last_name} Joined video Session As A Viewer</div></div></div>`;
            break;
        }
        case 19: { // Configured reported address
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><i class="fas fa-map-marker-alt font-size-fontAwesome"></i></div>
                <div>Configured Reported Address</div></div></div>`;
            break;
        }
        case 20: { // Clicked on live video link
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="./images/live-video/red-video.png" class="pr-1 panic-btn-img"></div>
                <div style="color:red">Caller: ${getCallerHtml(caseNotesSMS.from_number)} clicked on Live Video Link to initiate emergency Live Video session</div></div></div>`;
            break;
        }
        case 21: { // Live video ended
            if (caseNotesSMS.submitter.first_name && caseNotesSMS.submitter.last_name) {
                caseNotesHtml += `<div style="font-size: 13px;">
                    <div class="aligment-icon"><div class="icon-padding pr-1"><i class="fal fa-ban font-size-fontAwesome"></i></div>
                    <div>${caseNotesSMS.submitter.first_name} ${caseNotesSMS.submitter.last_name} ended Live Video </div></div></div>`;
            } else {
                caseNotesHtml += `<div style="font-size: 13px;">
                    <div class="aligment-icon"><div class="icon-padding pr-1"><i class="fal fa-ban font-size-fontAwesome"></i></div>
                    <div style="padding-top:1px;"> Live Video Ended </div></div></div>`;
            }
            break;
        }
        case 22: { // Sent SMS with URL
            let block = "";
            if (caseNotesSMS.from_number) {
                if (caseNotesSMS.live_video?.live_video_report_id) {
                    block = `<img src="./images/live-video/chat_blue.png" class="pr-1 panic-btn-img"> <b>Texted a LIVE Video url (${liveVideoBase + caseNotesSMS.live_video.live_video_report_id}) to ${getCallerHtml(caseNotesSMS.from_number)}</b>`;
                } else if (caseNotesSMS.media_upload?.media_upload_report_id) {
                    block = `<img src="./images/camera.png" class="pr-1 panic-btn-img"> <b>Sent the Media Upload URL:${mediaUploadBase + caseNotesSMS.media_upload.media_upload_report_id}</b>`;
                } else if (caseNotesSMS.location_sharing?.location_sharing_report_id) {
                    block = `<img src="/images/sms-chat/location-share-icon.png" class="pr-1 panic-btn-img"> <b>Sent the Location Sharing URL:${locationSharingBase + caseNotesSMS.location_sharing.location_sharing_report_id}</b>`;
                }
            } else {
                if (caseNotesSMS.live_video?.live_video_report_id) {
                    block = `<img src="./images/live-video/chat_blue.png" class="pr-1 panic-btn-img"> <b>Texted a LIVE Video url (${liveVideoBase + caseNotesSMS.live_video.live_video_report_id})</b>`;
                } else if (caseNotesSMS.media_upload?.media_upload_report_id) {
                    block = `<img src="./images/camera.png" class="pr-1 panic-btn-img"> <b>Sent the Media Upload URL:${mediaUploadBase + caseNotesSMS.media_upload.media_upload_report_id}</b>`;
                } else if (caseNotesSMS.location_sharing?.location_sharing_report_id) {
                    block = `<img src="/images/sms-chat/location-share-icon.png" class="pr-1 panic-btn-img"> <b>Sent the Location Sharing URL:${locationSharingBase + caseNotesSMS.location_sharing.location_sharing_report_id}</b>`;
                }
            }
            caseNotesHtml += `<div style="font-size: 13px;"><div class="aligment-icon"><div class="icon-padding pr-1">${block}</div></div></div>`;
            break;
        }
        case 23: { // Blank
            break;
        }
        case 24: { // Live video interrupted
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="/images/live-video/inti.png" style="width:30px" class="pr-1 p-d-t-2 panic-btn-img"></div>
                <div style="color:red"><b>Live video stream was interrupted.</b></div></div></div>`;
            break;
        }
        case 25: { // Live video resumed
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="/images/live-video/red-video.png" class="pr-1 p-d-t-4 panic-btn-img"></div>
                <div><b>Live video stream was resumed.</b></div></div></div>`;
            break;
        }
        case 26: { // Live video paused
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="/images/live-video/red-video.png" class="pr-1 p-d-t-4 panic-btn-img"></div>
                <div style="color:red"><b>Live video stream was paused.</b></div></div></div>`;
            break;
        }
        case 27: { // Live video ended due to inactivity
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="/images/live-video/red-video.png" class="pr-1 p-d-t-4 panic-btn-img"></div>
                <div style="color:red"><b>Live video stream was ended because of inactivity.</b></div></div></div>`;
            break;
        }
        case 28: { // Ended conversation
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1" style="padding-top:2px"><i class="fal fa-ban font-size-fontAwesome"></i></div>
                <div>${caseNotesSMS.submitter.first_name} ${caseNotesSMS.submitter.last_name} Ended Conversation</div></div></div>`;
            break;
        }
        case 29: { // Clicked on live video link
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="./images/live-video/red-video.png" class="pr-1 panic-btn-img"></div>
                <div style="color:red">Caller: ${getCallerHtml(caseNotesSMS.from_number)} initiated emergency Live Video session</div></div></div>`;
            break;
        }
        case 30: { // Chat timeout
            caseNotesHtml += '<span class="desc-caseNotes"><span class="text-info">Chat has closed automatically due to timeout</span></span>';
            break;
        }
        case 31: { // Started SMS conversation
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1" style="padding-top:2px"><img src="/images/chat@2x.png" width="18"></div>
                <div>Started a SMS conversation with reporter.</div></div></div>`;
            break;
        }
        case 32: { // Ended sharing location
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="/images/sms-chat/location-share-icon.png" class="pr-1 panic-btn-img"></div>
                <div><b>Ended Sharing Location: </b>${caseNotesSMS.submitter_location.address}</div></div></div>`;
            break;
        }
        case 33: { // Updated location
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="/images/sms-chat/location-share-icon.png" class="pr-1 panic-btn-img"></div>
                <div><b>Updated Location: </b>${caseNotesSMS.submitter_location.address}</div></div></div>`;
            break;
        }
        case 34: { // Started sharing location
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="/images/sms-chat/location-share-icon.png" class="pr-1 panic-btn-img"></div>
                <div><b>Started Sharing Location: </b>${caseNotesSMS.submitter_location.address}</div></div></div>`;
            break;
        }
        case 35: { // Shared live video URL
            let sharedBy = "";
            if (caseNotesSMS.submitter.first_name) {
                sharedBy += caseNotesSMS.submitter.first_name;
                if (caseNotesSMS.submitter.last_name) {
                    sharedBy += ' ' + caseNotesSMS.submitter.last_name;
                }
            }
            let details = [];
            if (caseNotesSMS.viewers.phone_numbers.length) {
                details.push('Phone Numbers ' + caseNotesSMS.viewers.phone_numbers.join(', '));
            }
            if (caseNotesSMS.viewers.email_ids.length) {
                details.push('Emails ' + caseNotesSMS.viewers.email_ids.join(', '));
            }
            if (caseNotesSMS.viewers.groups.length) {
                details.push('Groups ' + caseNotesSMS.viewers.groups.map(g => g.name).join(', '));
            }
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><img src="/images/sms-chat/chat_blue.png" class="pr-1 panic-btn-img"></div>
                <div>${sharedBy} shared the live video url: ${details.join(' ')}</div></div></div>`;
            break;
        }
        case 38: { // Initiated Phone Call to SaferWatch LTE Panic Button
            caseNotesHtml += `<div style="font-size: 13px;">
                <div class="aligment-icon"><div class="icon-padding pr-1"><i class="fal fa-phone font-size-fontAwesome mr-1 fa-flip-horizontal"></i></div>
                <div>Initiated Phone Call to SaferWatch LTE Panic Button</div></div></div>`;
            break;
        }
        case 39: { // SaferWatch LTE Panic Button Call Recording
            caseNotesHtml += `<div style="font-size: 13px;"><label style="color:#808080;">SaferWatch LTE Panic Button Call Recording:</label><ul>`;
            caseNotesSMS.media.forEach((m, idx) => {
                caseNotesHtml += `<li style="font-size: 13px;"><label style="color:#808080;">File ${idx + 1}:</label> <a target="_blank" href="${mediaHost + m.media_key}">${mediaHost + m.media_key}</a></li>`;
            });
            caseNotesHtml += '</ul></div>';
            break;
        }
        case 50: { // ALPR Detected
            const lp = caseNotesSMS.lp || "N/A";
            const camera = caseNotesSMS.camera_id;
            caseNotesHtml += `<span style="font-size: 13px;"><span class="aligment-icon"><span class="icon-padding pr-1">`;
            if (camera && camera !== "N/A") {
                caseNotesHtml += `LP ${lp} was detected from Camera ${camera}`;
            } else {
                caseNotesHtml += `LP ${lp} was detected`;
            }
            caseNotesHtml += '</span></span></span>';
            break;
        }
        default:
            caseNotesHtml += caseNotesSMS.comment_text;
            break;
    }
    
    return caseNotesHtml;
}

function convertToUSFormat(number) {
    var num = number.replace(/[^0-9]/g, "")
    if (num.length == 13) {
        var parts = [num.slice(0, 3), num.slice(3, 6), num.slice(6, 10), num.slice(10, 13)];
        var fNum = parts[0] + " (" + parts[1] + ") " + parts[2] + "-" + parts[3];
        return "+" + fNum;
    } else if (num.length == 12) {
        var parts = [num.slice(0, 2), num.slice(2, 5), num.slice(5, 8), num.slice(8, 12)];
        var fNum = parts[0] + " (" + parts[1] + ") " + parts[2] + "-" + parts[3];
        return "+" + fNum;
    } else if (num.length == 10) {
        var parts = [num.slice(0, 3), num.slice(3, 6), num.slice(6, 10)];
        var fNum = " (" + parts[0] + ") " + parts[1] + '-' + parts[2];
        return fNum;
    } else if (num.length == 11) {
        var parts = [num.slice(0, 1), num.slice(1, 4), num.slice(4, 7), num.slice(7, 11)];
        var fNum = parts[0] + " (" + parts[1] + ") " + parts[2] + "-" + parts[3];
        return "+" + fNum;
    } else {
        var fNum = "N/A";
        return number;
    }
}