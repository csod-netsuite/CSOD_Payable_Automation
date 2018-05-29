define(['N/record', 'N/search'], function (record, search) {

    /**
     * Module Description...
     *
     * @exports XXX
     *
     *
     * @NApiVersion 2.x
     * @NModuleScope SameAccount
     * @NScriptType ClientScript
     */
    var exports = {};

    var SUBLIST_FIELDS_TO_UPDATE = ['item', 'amount', 'custcol_plan_end_date',
        'custcol_plan_start_date', 'custcol_content_provider_fee', 'quantity'];

    var FIELDS_MAP = {
        item: 'custrecord_pid_item',
        amount: 'custrecord_pid_so_line_amount',
        custcol_plan_end_date: 'custrecord_pid_end_date',
        custcol_plan_start_date: 'custrecord_pid_start_date',
        custcol_content_provider_fee: 'custrecord_pid_payable_amount',
        quantity: 'custrecord_pid_item_quantity'
    };

    var updatePayableId = function(context) {
        var currRecord = context.currentRecord;
        var sublistName = context.sublistId;
        var sublistFieldName = context.fieldId;
        var line = context.line;
        var lookupLoaded = false;
        var lookupFieldsObj;

        if(sublistName == 'item' && SUBLIST_FIELDS_TO_UPDATE.indexOf(sublistFieldName) > -1) {

            var linePayableId = currRecord.getSublistValue({sublistId: 'item', fieldId: 'custcol_csod_payable_id', line: line});
            if(linePayableId) {

                if(!lookupLoaded) {
                    lookupFieldsObj = loadLookupFields(linePayableId);
                    lookupLoaded = true;
                }

                log.debug('lookupFieldsObj value check', lookupFieldsObj);

                // process only if custrecord_pid_all_bills_created field is unchecked
                if(!lookupFieldsObj.custrecord_pid_all_bills_created) {
                    var currValue = currRecord.getCurrentSublistValue({sublistId: 'item', fieldId: sublistFieldName});
                    var correspondingValue = lookupFieldsObj[FIELDS_MAP[sublistFieldName]];

                    log.debug("Value checks", "currValue = " + forceConvertFloat(currValue) + ", correspondingValue = " + correspondingValue)

                    if(forceConvertFloat(currValue) != forceConvertFloat(correspondingValue)) {
                        currRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_csod_update_line_payable',
                            value: true
                        });
                    }
                }

            }
        }
    };

    var loadLookupFields = function(payableId) {
        var lookupObj = search.lookupFields({
            type: 'customrecord_csod_pid',
            id: payableId,
            columns: ['custrecord_pid_item', 'custrecord_pid_so_line_amount', 'custrecord_pid_end_date',
            'custrecord_pid_start_date', 'custrecord_pid_payable_amount', 'custrecord_pid_item_quantity', 'custrecord_pid_all_bills_created']
        });

        if(lookupObj.custrecord_pid_item[0]) {
            lookupObj.custrecord_pid_item = lookupObj.custrecord_pid_item[0].value;
        }

        return lookupObj;
    }

    
    var forceConvertFloat = function(value) {
    	if(isNaN(parseFloat(value))) {
    		return value;
    	} else {
    		return parseFloat(value);
    	}
    }

    exports.fieldChanged = updatePayableId;
    return exports;
});
