const fs = require("fs")
const path = require("path")



const soapRequest = require("easy-soap-request");
const parser = require('fast-xml-parser');
const he = require('he');
const options = {
    attributeNamePrefix: "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName: "#text",
    ignoreAttributes: true,
    ignoreNameSpace: true,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    parseTrueNumberOnly: false,
    arrayMode: false,
    attrValueProcessor: (val, attrName) => he.decode(val, {isAttributeValue: true}),
    tagValueProcessor: (val, tagName) => he.decode(val),
    stopNodes: ["parse-me-as-string"]
};
const moment = require("moment")

const sequelize = require("./database/sql_database")
const VodafoneAccts = require("./database/sql_models").VodafoneAccts

const input_file = `${__dirname}/input_dir/input_file.lst`
const processed_file = `${__dirname}/processed_dir/${moment().format("YYYYMMDDHHmmss")}-input_file.lst`


const URL ="http://172.21.7.6:18100";


sequelize.sync({

}).then(() =>{
    console.log("Mysql DB successfully connected")
    fs.readFile(input_file,{encoding:'utf-8'},async (err, data) => {
        if (err) throw err
        const dataArray = data.trim().split("\n");
        let counter=0
        for (const row of dataArray) {
            let tempArray =row.split(",")
            let [msisdn,iccid,imsi,authKeys] = tempArray
            let profileID = iccid.toString().substring(12)
            try {
                if (await createAuthKeys(imsi, authKeys,msisdn)) {
                    if (await createSubDetails(profileID, msisdn, imsi)) {
                        console.log(`${msisdn} successfully created on HSS`)
                        counter++
                        await VodafoneAccts.create({
                            imsi,
                            iccid,
                            msisdn,
                            authKeys,
                            profileID,
                            fileName: processed_file,
                            status: "active",
                        })
                        console.log(`${msisdn} successfully created in local DB`)
                    }
                }
            } catch (exp) {
                console.log(`Error in creating ${msisdn} in HSS`)
                console.log(exp)
            }

        }

        console.log("=========================================")
        console.log(`Total sims successfully provisioned on HSS => ${counter}`)
        console.log("=========================================")

        fs.rename(input_file,processed_file,err1 => {
            if (err1) console.log("Error in moving file",err1)

        })
    })

}).catch(error =>{
    console.log("Unable to connect to Mysql DB")
    console.log(error)

})


async function createAuthKeys(imsi, authkeys,msisdn) {
    let msin = imsi.toString().substring(5);
    const sampleHeaders = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
    };

    let xmlRequest=`<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:al="http://www.alcatel-lucent.com/soap_cm" xmlns:bd="http://www.3gpp.org/ftp/Specs/archive/32_series/32607/schema/32607-700/BasicCMIRPData" xmlns:bs="http://www.3gpp.org/ftp/Specs/archive/32_series/32607/schema/32607-700/BasicCMIRPSystem" xmlns:gd="http://www.3gpp.org/ftp/Specs/archive/32_series/32317/schema/32317-700/GenericIRPData" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <SOAP-ENV:Body>
      <bd:createMO>
         <mOIElementLoc>aucServiceProfileId=1,mSubIdentificationNumberId=${msin},mobileNetworkCodeId=08,mobileCountryCodeId=620,plmnFunctionId=1,managedElementId=HSS1</mOIElementLoc>
         <referenceObjectInstance />
         <mO>
            <moiLocation>aucServiceProfileId=1,mSubIdentificationNumberId=${msin},mobileNetworkCodeId=08,mobileCountryCodeId=620,plmnFunctionId=1,managedElementId=HSS1</moiLocation>
            <al:moAttributeList>
               <al:moAttribute>
                  <al:name>authenticationSubscriberType</al:name>
                  <al:value>UMTS_MS</al:value>
               </al:moAttribute>
               <al:moAttribute>
                  <al:name>authKey</al:name>
                  <al:value>${authkeys}</al:value>
               </al:moAttribute>
               <al:moAttribute>
                  <al:name>algorithmPosition</al:name>
                  <al:value>1</al:value>
               </al:moAttribute>
               <al:moAttribute>
                  <al:name>allowedSequenceNumber</al:name>
                  <al:value>PS</al:value>
                  <al:value>EPS</al:value>
                  <al:value>IMS</al:value>
               </al:moAttribute>
            </al:moAttributeList>
         </mO>
      </bd:createMO>
   </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    try {
        const {response} = await soapRequest({url: URL, headers: sampleHeaders, xml: xmlRequest, timeout: 6000}); // Optional timeout parameter(milliseconds)
        const {body} = response;
        let jsonObj = parser.parse(body, options);
        let result = jsonObj.Envelope.Body;
        return !!(result.createMOResponse && result.createMOResponse.mO && result.createMOResponse.mO.moiLocation);
    } catch (e) {
        console.log("Error in creating AUC ",msisdn)
        throw e
    }

}
async function createSubDetails(profileId, msisdn,imsi) {
    let msin = imsi.toString().substring(5);
    let missdn_temp = msisdn.toString().substring(5)
    let msisdn_temp2 = msisdn.toString().substring(3,5)
    const sampleHeaders = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
    };

    let xmlRequest=`<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:bd="http://www.3gpp.org/ftp/Specs/archive/32_series/32607/schema/32607-700/BasicCMIRPData" xmlns:bs="http://www.3gpp.org/ftp/Specs/archive/32_series/32607/schema/32607-700/BasicCMIRPSystem" xmlns:gd="http://www.3gpp.org/ftp/Specs/archive/32_series/32317/schema/32317-700/GenericIRPData" xmlns:mO="http://www.alcatel-lucent.com/soap_cm" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <SOAP-ENV:Body>
      <bd:createMO>
         <mOIElementLoc>gsmServiceProfileId=1,suMSubscriptionProfileId=1,suMSubscriberProfileId=1-${profileId},subscriptionFunctionId=1,managedElementId=HSS1</mOIElementLoc>
         <referenceObjectInstance />
         <mO>
            <moiLocation>gsmServiceProfileId=1,suMSubscriptionProfileId=1,suMSubscriberProfileId=1-${profileId},subscriptionFunctionId=1,managedElementId=HSS1</moiLocation>
            <mO:moAttributeList>
               <mO:moAttribute>
                  <mO:name>mSubIdentificationNumberId</mO:name>
                  <mO:value>${msin}</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>mobileCountryCodeId</mO:name>
                  <mO:value>620</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>mobileNetworkCodeId</mO:name>
                  <mO:value>08</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>MainSNwithBearerService</mO:name>
                  <mO:value>233-${msisdn_temp2}-${missdn_temp}:GPRS</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>networkAccessMode</mO:name>
                  <mO:value>GPRSonly</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>accessRestrictionData</mO:name>
                  <mO:value>NORES</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>epsAccessSubscriptionType</mO:name>
                  <mO:value>3GPP</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>maxRequestedBandwidthDL</mO:name>
                  <mO:value>104857600</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>maxRequestedBandwidthUL</mO:name>
                  <mO:value>503316480</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>epsApnContextSetList</mO:name>
                  <mO:value>1/15/3GPP///50575C60/////3GPP/0</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>apnOiReplacement</mO:name>
                  <mO:value>mnc008.mcc620.gprs</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>ratFreqSelectPriorityId</mO:name>
                  <mO:value>1</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>epsServiceProfile</mO:name>
                  <mO:value>true</mO:value>
               </mO:moAttribute>
               <mO:moAttribute>
                  <mO:name>chargingCharacteristics</mO:name>
                  <mO:value>NORMAL</mO:value>
               </mO:moAttribute>
            </mO:moAttributeList>
         </mO>
      </bd:createMO>
   </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    try {
        const {response} = await soapRequest({url: URL, headers: sampleHeaders, xml: xmlRequest, timeout: 6000}); // Optional timeout parameter(milliseconds)
        const {body} = response;
        let jsonObj = parser.parse(body, options);
        let result = jsonObj.Envelope.Body;
        return !!(result.createMOResponse && result.createMOResponse.mO && result.createMOResponse.mO.moiLocation);
    } catch (e) {
        console.log("Error in creating HSS Sub ",msisdn)
        throw e
    }

}

