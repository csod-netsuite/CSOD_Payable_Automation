/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record'],
/**
 * @param {record} record
 */
function(record) {

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function createPayableId(scriptContext) {

        var newRec = scriptContext.newRecord;
        var itemLineCount = newRec.getLineCount('item');
        var numLinesUpdated = 0;

        for(var i = 0; i < itemLineCount; i++) {
            var payableId = newRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_csod_payable_id',
                line: i
            });

            var contentFee = +newRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_content_provider_fee',
                line: i
            });

            var vendorId = +newRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_preferred_vendor',
                line: i
            });
            
            // only run if payableId is empty
            if(!payableId && contentFee > 0) {
                if(vendorId) {

                    var orderLineObj = createOrlineLineObj(newRec, i);
                    var newPayableRecId = createNewPayableIdRecord(orderLineObj);
                    
                    log.audit('New Payable Record Created with ID: ' + newPayableRecId);
                    
                    if(newPayableRecId) {
                    	newRec.setSublistValue({
                    		sublistId: 'item',
                    		fieldId: 'custcol_csod_payable_id',
                    		line: i,
                    		value: newPayableRecId
                    	});
                    	
                    	numLinesUpdated++;
                    }
                }
            }
        }
        
        log.audit("createPayableId - Num of Lines Changed : " + numLinesUpdated);
    }

    var createOrlineLineObj = function(newRec, lineNum) {
        /*
        custrecord_pid_item: item
        custrecord_pid_saleorder_link: record_id
        custrecord_pid_salesorder_line_id : lineuniquekey
        custrecord_pid_vendor_link : custcol_preferred_vendor
        custrecord_pid_payable_amount: custcol_content_provider_fee
        custrecord_pid_start_date: custcol_plan_start_date
        custrecord_pid_end_date: custcol_plan_end_date
        custrecord_pid_transaction_currency: currency

        */

        var orderLineObj = {};

        orderLineObj.custrecord_pid_item = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: lineNum
        });

        orderLineObj.custrecord_pid_saleorder_link = newRec.id;

        orderLineObj.custrecord_pid_salesorder_line_id = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'lineuniquekey',
            line: lineNum
        });

        orderLineObj.custrecord_pid_vendor_link = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_preferred_vendor',
            line: lineNum
        });

        orderLineObj.custrecord_pid_payable_amount = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_content_provider_fee',
            line: lineNum
        });

        orderLineObj.custrecord_pid_start_date = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_plan_start_date',
            line: lineNum
        });

        orderLineObj.custrecord_pid_end_date = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_plan_end_date',
            line: lineNum
        });

        orderLineObj.custrecord_pid_transaction_currency = newRec.getValue('currency');

        log.debug({
            title: 'orderLineObj value check',
            details: JSON.stringify(orderLineObj)
        });

        return orderLineObj;

    };

    var createNewPayableIdRecord = function(orderLineObj) {
    	
    	log.audit('Creating new Payable ID Record');
    	
    	
    	try {
			var payableRec = record.create({
				type: 'customrecord_csod_pid'
			});
			
			for(var field in orderLineObj) {
				payableRec.setValue({
					fieldId: field,
					value: orderLineObj[field]
				});
			}
			
    		var recId = payableRec.save();
    		
    		return recId;
    		
    	} catch(e) {
    		log.error({
    			title: 'ERROR CREATING PAYABLE ID',
    			details: e
    		});
    	}
    };



    return {
        beforeSubmit: createPayableId
    };
    
});
