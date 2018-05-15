define(['N/search', 'N/record', 'N/runtime', '../Lib/moment', 'N/format'], 
		function (search, record, runtime, moment, format) {

    /**
     * Creates Payable Bills off of Payable ID (Custom Record)
     *
     *
     * @copyright 2018 Cornerstone OnDemand
     * @author Chan Yi <cyi@csod.com>
     *
     * @NApiVersion 2.x
     * @NModuleScope SameAccount
     * @NScriptType MapReduceScript
     */

    var exports = {};
    var scriptObj = runtime.getCurrentScript();

    function PayableObj(){
    	this.payableId = null;
        this.isSpecial = null;
        this.isMultiyearLine = null;
        this.numberOfYears = null;
        this.vendor = null;
        this.useVendorCurrency = false;
        this.vendorCurrency = null;
        this.subsidiary = null;
        this.startdate = null;
        this.enddate = null;
        this.approvalstatus = 'Pending Approval';
        this.location = null;
        this.department = null;
        this.salesorder = null;
        this.customer = null;
        this.items = [];
        this.salesOrderLineId = null;
        this.amount = 0;
        this.trandate = null;
    };


    function PayableItemsObj(){
        this.item = null;
        this.contentoption = null;
        this.description = null;
        this.startdate = null;
        this.enddate = null;
        this.commissionyear = null;
        this.licensesandusers = null;
        this.vendorname = null;
        this.quantity = null;
        this.rate = null;
        this.amount = null;
        this.createpayable = null;
        this.preferredvendor = null;
        this.contentprovfee = null;
    };
    

    function createPayableObj(payableIdObj, multiVendor, multiVenPayoutObj) {

        log.debug({
            title: 'payableIdObj Check',
            details: payableIdObj
        });
        


        var startDate = payableIdObj.values.custrecord_pid_start_date;
        var endDate = payableIdObj.values.custrecord_pid_end_date;
        
        // getting values to determine for multi-year line
        var momentStartDate = moment(startDate);
        var momentEndDate = moment(endDate);

        // get difference between start and end date in days and years
        var contractLengthDays = Math.abs(momentEndDate.diff(momentStartDate, 'days'));
        // Length in years
        var contractLengthYears = (+contractLengthDays%365) > 362 ? Math.round(+contractLengthDays/365) : Math.ceil(+contractLengthDays/365);
        
        var salesOrderId = payableIdObj.values.custrecord_pid_saleorder_link.value;
        var totalAmount = +payableIdObj.values.custrecord_pid_payable_amount;
        
        var lineUniqueId = payableIdObj.values.custrecord_pid_salesorder_line_id;
        var salesOrderCurrency = payableIdObj.values.custrecord_pid_transaction_currency.value;
        var vendonId;
        if(multiVendor) {
        	vendonId = multiVenPayoutObj.payout_vendor;
        } else {
        	vendonId = payableIdObj.values.custrecord_pid_vendor_link.value;
        }
        var itemQuantity = payableIdObj.values.custrecord_pid_item_quantity;
        var itemId = payableIdObj.values.custrecord_pid_item;
        
        // lookup for Sales Order record
        var soLookups = search.lookupFields({
            type: search.Type.SALES_ORDER,
            id: salesOrderId,
            columns: ['location', 'department', 'subsidiary', 'entity']
        });

        // lookup for Vendor Record to get related currency data
        var vendorLookups = search.lookupFields({
            type: search.Type.VENDOR,
            id: vendonId,
            columns: ['currency', 'custentity_csod_use_primary_curr_payable']
        });

        var returnArr = [];
        var tranDateTemp = null;
        // append object to returnArr
        for(var i = 1; i <= contractLengthYears; i++) {
        	
            var headerObj = new PayableObj();

            headerObj.payableId = payableIdObj.id;
            headerObj.isMultiyearLine =  contractLengthYears > 1;
            headerObj.numberOfYears = contractLengthYears;
            headerObj.startdate = momentStartDate._d;
            headerObj.enddate = momentEndDate._d;
            headerObj.vendor = vendonId;
            headerObj.salesOrderLineId = lineUniqueId;
            headerObj.salesorder = salesOrderId;
            
            if(vendorLookups.currency[0]) {
                headerObj.vendorCurrency = vendorLookups.currency[0].value;
            }
            
            if(vendorLookups.custentity_csod_use_primary_curr_payable) {
                headerObj.useVendorCurrency = true;
            }

            if(soLookups.department[0]) {
                headerObj.department = soLookups.department[0].value;
            }

            if(soLookups.location[0]) {
                headerObj.location = soLookups.location[0].value;
            }

            if(soLookups.subsidiary[0]) {
                headerObj.subsidiary = soLookups.subsidiary[0].value;
            }
            
            if(soLookups.entity[0]) {
            	headerObj.customer = soLookups.entity[0].value;
            }
        	
        	if(tranDateTemp === null) {
        		headerObj.trandate = momentStartDate._d;
        		tranDateTemp = momentStartDate._d;
        	} else {
        		headerObj.trandate = moment(tranDateTemp).add(12, 'months')._d;
        		tranDateTemp = moment(tranDateTemp).add(12, 'months')._d;
        	}
        	
        	if(i == contractLengthYears) {
        		tranDateTemp = null;
        	}
        	
        	headerObj.items = [createPayableObjItem(totalAmount, contractLengthYears, itemQuantity, 
        			momentStartDate._d, momentEndDate._d, multiVendor, multiVenPayoutObj)];    	
        	
        	log.debug({
        		title: 'headerObj value check',
        		details: headerObj
        	});
        	
        	returnArr.push(headerObj);
        	
        }

        return returnArr;
    }
    
    

    function createPayableObjItem(totalAmount, numOfYears, qty, startDate, endDate, multiVendor, multiVenPayoutObj) {
    	var lineObj = new PayableItemsObj();
    	
    	var payoutPct = (multiVendor) ? parseFloat(multiVenPayoutObj.payout_percent) : 1;
    	
    	log.debug("payoutPct = " + payoutPct);
    	
    	if(numOfYears > 1) {
    		lineObj.amount = (totalAmount / numOfYears) / payoutPct;
    	} else {
    		lineObj.amount = totalAmount / payoutPct;
    	}
    	
    	lineObj.rate = lineObj.amount / qty;
    	lineObj.startdate = startDate;
    	lineObj.enddate = endDate;
    	lineObj.quantity = qty;
    	
    	return lineObj
    }
    
    function getMultiVendorItems() {
    	// TODO - complete this function - Created an array of multi vendor items and return it
    	
    	return ['2421','2429'];
    }
    
    function getMultiVendorPayoutObjs(itemId) {
    	
    	log.audit("getMultiVendorPayoutObj " + itemId );
    	
    	var customrecord_multi_ven_pay_tableSearchObj = search.create({
    		   type: "customrecord_multi_ven_pay_table",
    		   filters:
    		   [
    		      ["isinactive","is","F"], 
    		      "AND", 
    		      ["custrecord_item_parent.internalidnumber","equalto",itemId]
    		   ],
    		   columns:
    		   [
    		      "custrecord_ven_1_payout",
    		      "custrecord_vendor_1_pay_percent",
    		      "custrecord_ven_2_payout",
    		      "custrecord_vendor_2_pay_percent",
    		      "custrecord_ven_3_payout",
    		      "custrecord_vendor_3_pay_percent",
    		      "custrecord_ven_4_payout",
    		      "custrecord_vendor_4_pay_percent",
    		      "custrecord_ven_5_payout",
    		      "custrecord_vendor_5_pay_percent"
    		   ]
    		});
    		var searchResultCount = customrecord_multi_ven_pay_tableSearchObj.runPaged().count;
    		log.debug("customrecord_multi_ven_pay_tableSearchObj result count",searchResultCount);
    		
    		var vendorPayoutObj = {};
    		var index = 1;
    		
    		if(searchResultCount === 1) {
    			
    			customrecord_multi_ven_pay_tableSearchObj.run().each(function(result) {
    				
    				for(var i = 0; i < result.columns.length; i++) {
    					
    					
    					var col = result.columns[i];
    					
    					if(col.name.indexOf('percent') > -1) {
    						
    						vendorPayoutObj['index_' + index]['payout_percent'] = result.getValue(col);
    						index += 1;
    					} else {
    						vendorPayoutObj['index_' + index] = {};
    						vendorPayoutObj['index_' + index]['payout_vendor'] = result.getValue(col);
    					}
    				}
    			
    		});
    		log.debug({
    			title: "vendorPayoutObj value check",
    			details: vendorPayoutObj
    		});
    		return vendorPayoutObj;
    	}
    	else {
			log.error({
				title: 'ERROR IN funtion getMultiVendorPayoutObj',
				details: 'MORE THAN 1 OR NO RECORD FOUND FOR ITEM ID  : ' + itemId
			});
    	}
    		
    }

    exports.config = {
        exitOnError: false
    };

    var getInputData = function getInputData() {
        return search.create({
            type: "customrecord_csod_pid",
            filters:
                [
                    ["custrecord_pid_all_bills_created","is","F"]
                ],
            columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"}),
                    search.createColumn({name: "custrecord_pid_start_date", label: "Start Date"}),
                    search.createColumn({name: "custrecord_pid_end_date", label: "End Date"}),
                    search.createColumn({name: "custrecord_pid_payable_amount", label: "Payable Amount"}),
                    search.createColumn({name: "custrecord_pid_saleorder_link", label: "Sales Order"}),
                    search.createColumn({name: "custrecord_pid_salesorder_line_id", label: "Sales Order Line ID"}),
                    search.createColumn({name: "custrecord_pid_transaction_currency", label: "Transaction Currency"}),
                    search.createColumn({name: "custrecord_pid_vendor_link", label: "Vendor Link"}),
                    search.createColumn({name: "custrecord_pid_item", label: "Item"}),
                    search.createColumn({name: "custrecord_pid_item_quantity", label: "Item Quantity"})
                ]
        });
    };


    var map = function(context) {
        // build payable object and write to context
        log.debug({
            title: 'Context check',
            details: context
        });
        
        var payableObjArr = [];
        
    	const MULTI_VENDOR_ITEMS = getMultiVendorItems();
    	// TODO handle if the item is content anytime (payout tables)
        
    	var contextValue = JSON.parse(context.value);
    	
    	if(MULTI_VENDOR_ITEMS.indexOf(contextValue.values.custrecord_pid_item.value) > -1) {
    		// item is multi-vendor item 
    		// create object based on "content anytime" requirements
    		
    		var multiVenPayoutObjs = getMultiVendorPayoutObjs(contextValue.values.custrecord_pid_item.value);
    		
    		for (index in multiVenPayoutObjs) {
    			
    			var multiVenPayoutObj = multiVenPayoutObjs[index];
    			payableObjArr.push(createPayableObj(contextValue, true, multiVenPayoutObj));
    			log.debug({
    	        	title: "Final PayableObjArr value check",
    	        	details: payableObjArr
    	        });
    		}
    		
    		
    	} else {
    	
    		payableObjArr.push(createPayableObj(contextValue, false));
    		
    		log.debug({
            	title: "Final PayableObjArr value check",
            	details: payableObjArr
            });
    	}

        context.write({
        	key: contextValue.id,
        	value: payableObjArr
        });

    };
    
    var reduce = function(context) {
    	
    	log.debug({
    		title: 'context value check',
    		details: context
    	});
    	
    	var contextValue = JSON.parse(context.values[0]);
    	
    	log.audit('contextValues length in reduce = ' + contextValue.length);
    	
    	for(var i = 0; i < contextValue.length; i++) {
    		
			log.debug({
				title: 'contextValue loop value check',
				details: contextValue[i]
			}) ;
    		
			var payableObjArr = contextValue[i];
			
			for(var x = 0; x < payableArr.length; x++) {
				var payableOjb = payableObjArr[x];
			}
    		
    	}
    	
    }

    exports.getInputData = getInputData;
    exports.map = map;
    exports.reduce = reduce;

    return exports;
});
