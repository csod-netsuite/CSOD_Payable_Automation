/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search) {
   
    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
    	
    	var payableId = context.request.parameters.payableId;
    	log.debug("payableId value check", payableId);
    	
    	if(payableId) {
    		var vendorbillSearchObj = search.create({
    			   type: "vendorbill",
    			   filters:
    			   [
    			      ["type","anyof","VendBill"], 
    			      "AND", 
    			      ["mainline","is","T"], 
    			      "AND", 
    			      ["custbody_csod_payable_id","anyof",payableId]
    			   ],
    			   columns: []
    			});
    			var searchResultCount = vendorbillSearchObj.runPaged().count;
    			log.debug("vendorbillSearchObj result count",searchResultCount);
    			
    			var errorNum = 0;
    			
    			try {
        			vendorbillSearchObj.run().each(function(result) {
        				
        				log.audit("Deleting", result.id);
        				
        				record.delete({
         				   type: record.Type.VENDOR_BILL,
         				   id: result.id
         			   });
         			   
        				
         			   return true;
         			});
    			} catch(e) {
    				errorNum++;
    				context.response.writeLine({
    					output: e
    				})
    				
    				log.error("ERROR WHILE DELETING BILLS", e);
    			}

    			if(errorNum == 0) {
    				
    				record.submitFields({
    					type: 'customrecord_csod_pid',
    					id: payableId,
    					values: {
    						custrecord_pid_all_bills_created: false
    					}
    				});
    				
    				context.response.writeLine({
    					output: 'success'
    				})

    			}

    	}
    }

    return {
        onRequest: onRequest
    };
    
});
