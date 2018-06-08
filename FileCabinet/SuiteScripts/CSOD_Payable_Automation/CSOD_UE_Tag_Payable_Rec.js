/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime', '../Lib/moment'],
/**
 * @param {record} record
 */
function(record, runtime, moment) {

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
	
	var exports = {};

    const REFERRAL_ITEM = runtime.getCurrentScript().getParameter('custscript_csod_referral_item_payable');



    /* BEFORE LOAD */
    function clearPayableIdRec(scriptContext) {
        if(scriptContext.type !== scriptContext.UserEventType.COPY) {
            return; // only run this script if context type is 'copy'
        }
        var newRec = scriptContext.newRecord;
        var headerPayableId = newRec.getValue('custbody_csod_referral_payable_id');

        if(headerPayableId) {
            newRec.setValue({
                fieldId: 'custbody_csod_referral_payable_id',
                value: ''
            })
        }

        var itemLineCount = scriptContext.newRecord.getLineCount('item');
        for(var i = 0; i < itemLineCount; i++) {
            var linePayableId = newRec.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_csod_payable_id',
                line: i
            });

            if(linePayableId) {

                newRec.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_csod_payable_id',
                    line: i,
                    value: ''
                });

                newRec.setSublistText({
                    sublistId: 'item',
                    fieldId: 'custcol_csod_payable_id',
                    line: i,
                    text: ''
                });

            }
        }

    }


    /* BEFORE SUBMIT */
    function writeClassSubtotal(scriptContext) {

        var startDate = scriptContext.newRecord.getValue('startdate');
        var endDate = scriptContext.newRecord.getValue('enddate');

        // getting values to determine for multi-year line
        var momentStartDate = moment(startDate);
        var momentEndDate = moment(endDate);

        // get difference between start and end date in days and years
        var contractLengthDays = Math.abs(momentEndDate.diff(momentStartDate, 'days'));
        // Length in years
        var contractLengthYears = (+contractLengthDays%365) > 362 ? Math.round(+contractLengthDays/365) : Math.ceil(+contractLengthDays/365);

        var referralFee = +scriptContext.newRecord.getValue('custbody_reseller_referral_fee');

        if(referralFee != 0) { // custbody_csod_non_commissionable
            scriptContext.newRecord.setValue({
                fieldId: 'custbody_csod_non_commissionable',
                value: referralFee * contractLengthYears
            })
        }

        var contentSubtotal = 0;
    	var profServSubtotal = 0;
    	var otherSubtotal = 0;
    	var subscriptionSubtotal = 0;
    	var contentFeeSubtotal = 0;

    	var itemLineCount = scriptContext.newRecord.getLineCount('item');
    	for(var i = 0; i < itemLineCount; i++) {
    		
    		var itemClass = scriptContext.newRecord.getSublistValue({
    			sublistId: 'item',
    			fieldId: 'class',
    			line: i
    		});

    		var contentFee = +scriptContext.newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_content_provider_fee',
                line: i
            });
    		
    		var amount = +scriptContext.newRecord.getSublistValue({
    			sublistId: 'item',
    			fieldId: 'amount',
    			line: i
    		});
    		
    		if (itemClass == '76') { //subscription

                subscriptionSubtotal += amount;
    		} else if (itemClass == '75') { //professional Services

                profServSubtotal += amount;
            } else if (itemClass == '39') { // other

                otherSubtotal += amount;
            } else if (itemClass == '77') { // content

                contentSubtotal += amount;
            }

            if(contentFee != 0) { // custbody_csod_non_commiss_content
                contentFeeSubtotal += contentFee;
            }
    		
    	}  // end for loop

        if(contentFeeSubtotal != 0){
    	    scriptContext.newRecord.setValue({
                fieldId: 'custbody_csod_non_commiss_content',
                value: contentFeeSubtotal.toFixed(2)
            })
        }

        scriptContext.newRecord.setValue({
            fieldId: 'custbody_csod_subtotal_subscription',
            value: subscriptionSubtotal.toFixed(2)
        });

        scriptContext.newRecord.setValue({
            fieldId: 'custbody_csod_subtotal_ps',
            value: profServSubtotal.toFixed(2)
        });

        scriptContext.newRecord.setValue({
            fieldId: 'custbody_csod_subtotal_other',
            value: otherSubtotal.toFixed(2)
        });

        scriptContext.newRecord.setValue({
            fieldId: 'custbody_csod_content_subtotal',
            value: contentSubtotal.toFixed(2)
        });

    }


    /* AFTER SUBMIT */
    function createPayableId(scriptContext) {

        if(scriptContext.type === scriptContext.UserEventType.DELETE) { // in delete event skip
            return;
        }

        var headerPayableUpdate = scriptContext.newRecord.getValue('custbody_csod_ref_payable_update');
        var headerPayable = scriptContext.newRecord.getValue('custbody_csod_referral_payable_id');
        var salesOrderId = scriptContext.newRecord.id;

        var soRecToResubmit = record.load({
           type: record.Type.SALES_ORDER,
           id: salesOrderId
        });

        var itemLineCount = scriptContext.newRecord.getLineCount('item');
        var numLinesUpdated = 0;

        if(headerPayableUpdate && headerPayable) {
            var headerUpdateParam = {};
            headerUpdateParam.custrecord_pid_start_date = scriptContext.newRecord.getValue('startdate');
            headerUpdateParam.custrecord_pid_end_date = scriptContext.newRecord.getValue('enddate');
            headerUpdateParam.custrecord_pid_payable_amount = scriptContext.newRecord.getValue('custbody_reseller_referral_fee');
            headerUpdateParam.custrecord_pid_vendor_link = scriptContext.newRecord.getValue('custbody_reseller_referral_partner');


            var updatedHeaderPayableID = record.submitFields({
                type: 'customrecord_csod_pid',
                id: headerPayable,
                values: headerUpdateParam,
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }

            });

            if(updatedHeaderPayableID) {

                soRecToResubmit.setValue({
                    fieldId: 'custbody_csod_ref_payable_update',
                    value: false
                });

                numLinesUpdated++;
            }

        }

        for(var i = 0; i < itemLineCount; i++) {
            var payableId = scriptContext.newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_csod_payable_id',
                line: i
            });

            var contentFee = +scriptContext.newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_content_provider_fee',
                line: i
            });

            var vendorId = +scriptContext.newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_preferred_vendor',
                line: i
            });

            var updatePayable = scriptContext.newRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_csod_update_line_payable',
                line: i
            });
            
            // only run if payableId is empty
            if(!payableId && contentFee > 0) {
                if(vendorId) {

                    var orderLineObj = createOrlineLineObj(scriptContext.newRecord, i);
                    var newPayableRecId = createNewPayableIdRecord(orderLineObj);
                    
                    log.audit('New Payable Record Created with ID: ' + newPayableRecId);
                    
                    if(newPayableRecId) {
                        soRecToResubmit.setSublistValue({
                    		sublistId: 'item',
                    		fieldId: 'custcol_csod_payable_id',
                    		line: i,
                    		value: newPayableRecId
                    	});
                    	
                    	numLinesUpdated++;
                    }
                }
            }

            // update payable record
            // if payableId is not empty and
            if(payableId && updatePayable) {

                var paramsObj = {};

                paramsObj.custrecord_pid_item =  scriptContext.newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });

                paramsObj.custrecord_pid_so_line_amount = scriptContext.newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                });

                paramsObj.custrecord_pid_end_date = scriptContext.newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tran_end_date',
                    line: i
                });

                paramsObj.custrecord_pid_start_date = scriptContext.newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tran_start_date',
                    line: i
                });

                paramsObj.custrecord_pid_payable_amount = scriptContext.newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_content_provider_fee',
                    line: i
                });

                paramsObj.custrecord_pid_item_quantity = scriptContext.newRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });

                var updatedPayableID = record.submitFields({
                    type: 'customrecord_csod_pid',
                    id: payableId,
                    values: paramsObj,
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }

                });

                // uncheck custcol_csod_update_line_payable
                if(updatedPayableID) {
                    soRecToResubmit.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_csod_update_line_payable',
                        value: false,
                        line: i
                    });

                    numLinesUpdated++
                }
            }

        }
        
        // Header Level
        var referralPartner = scriptContext.newRecord.getValue('custbody_reseller_referral_partner');
        var referralFee = +scriptContext.newRecord.getValue('custbody_reseller_referral_fee');
        var referralPayableId = scriptContext.newRecord.getValue('custbody_csod_referral_payable_id');

        log.audit({
            title: 'referral value check',
            details: 'referralPartner = ' + referralPartner + ', referralFee' + referralFee
        });

        // if referralPayableId is empty 
        if(!referralPayableId) {
            // create payable ID
            if(referralPartner && referralFee > 0 ) {
                // custbody_csod_referral_payable_id
                var referralPaybleObj = createReferralPayableObj(scriptContext.newRecord, REFERRAL_ITEM);
                var newPayableId = createNewPayableIdRecord(referralPaybleObj);

                if(newPayableId) {
                    soRecToResubmit.setValue({
                        fieldId: 'custbody_csod_referral_payable_id',
                        value: newPayableId
                    });

                	numLinesUpdated++;
                }
            }
        }

        log.audit("createPayableId - Num of Lines Changed : " + numLinesUpdated);

        if(numLinesUpdated > 0) {
            var salesOrderId = soRecToResubmit.save();
            log.audit(salesOrderId + ", resaved");
        }
    }


    var createReferralPayableObj = function(newRec, referralItem) {
        headerObj = {};

        headerObj.custrecord_pid_item = referralItem;
        headerObj.custrecord_pid_item_quantity = 1;
        headerObj.custrecord_pid_saleorder_link = newRec.id;
        headerObj.custrecord_pid_vendor_link = newRec.getValue('custbody_reseller_referral_partner');
        headerObj.custrecord_pid_payable_amount = newRec.getValue('custbody_reseller_referral_fee');
        headerObj.custrecord_pid_start_date = newRec.getValue('startdate');
        headerObj.custrecord_pid_end_date = newRec.getValue('enddate');
        headerObj.custrecord_pid_transaction_currency = newRec.getValue('currency');

        return headerObj;
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
        custrecord_pid_item_quantity: quantity
        */

        var orderLineObj = {};

        orderLineObj.custrecord_pid_item = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: lineNum
        });

        orderLineObj.custrecord_pid_item_quantity = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
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
            fieldId: 'custcol_tran_start_date',
            line: lineNum
        });

        orderLineObj.custrecord_pid_end_date = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_tran_end_date',
            line: lineNum
        });

        orderLineObj.custrecord_pid_so_line_amount = newRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
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

    exports.beforeLoad = clearPayableIdRec;
    exports.beforeSubmit = writeClassSubtotal;
    exports.afterSubmit = createPayableId;
    
    return exports;
    
});
