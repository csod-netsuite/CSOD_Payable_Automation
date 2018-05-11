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
        this.id = null;
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

    function createPayableObj(payableIdObj) {
    	
    	var returnArr = [];
        var headerObj = new PayableObj();

        var startDate = payableIdObj.values.custrecord_pid_start_date;
        var endDate = payableIdObj.values.custrecord_pid_end_date;
        var totalAmount = +payableIdObj.values.custrecord_pid_payable_amount;
        var salesOrderId = payableIdObj.values.custrecord_pid_saleorder_link.value;
        var lineUniqueId = payableIdObj.values.custrecord_pid_salesorder_line_id;
        var salesOrderCurrency = payableIdObj.values.custrecord_pid_transaction_currency.value;
        var vendonId = payableIdObj.values.custrecord_pid_vendor_link.value;
        
        //TODO get quantity from payableObj
        var quantity = 1;

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

        // getting values to determine for multi-year line
        var momentStartDate = moment(startDate);
        var momentEndDate = moment(endDate);

        // get difference between start and end date in days and years
        var contractLengthDays = Math.abs(momentEndDate.diff(momentStartDate, 'days'));
        // Length in years
        var contractLengthYears = (+contractLengthDays%365) > 362 ? Math.round(+contractLengthDays/365) : Math.ceil(+contractLengthDays/365);
        headerObj.isMultiyearLine =  contractLengthYears > 1;
        headerObj.numberOfYears = contractLengthYears;
        headerObj.startdate = momentStartDate._d;
        headerObj.enddate = momentEndDate._d;
        headerObj.vendor = vendonId;
        headerObj.salesOrderLineId = lineUniqueId;
        headerObj.salesorder = salesOrderId
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

        log.debug({
            title: "Some Values Check",
            details: 'startDate = ' + startDate + ", endDate = " + endDate + ", Currency ID = " + salesOrderCurrency
        });
        
        // append object to returnArr
        for(var i = 1; i <= contractLengthYears; i++) {
        	if(headerObj.trandate === null) {
        		headerObj.trandate = momentStartDate._d
        	} else {
        		headerObj.trandate = moment(headerObj.trandate).add(12, 'months')._d
        	}
        	
        	headerObj.items = [createPayableObjItem(totalAmount, contractLengthYears, quantity, momentStartDate._d, momentEndDate._d)];
        	
        	returnArr.push(headerObj);
        	
        	log.debug({
        		title: 'headerObj value check',
        		details: headerObj
        	});
        }

        return returnArr;
    }

    function createPayableObjItem(totalAmount, numOfYears, qty, startDate, endDate) {
    	var lineObj = new PayableItemsObj();
    	
    	if(numOfYears > 1) {
    		lineObj.amount = totalAmount / numOfYears;
    	} else {
    		lineObj.amount = totalAmount;
    	}
    	
    	lineObj.rate = lineObj.amount / qty;
    	lineObj.startdate = startDate;
    	lineObj.enddate = endDate;
    	
    	return lineObj
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
                    search.createColumn({name: "custrecord_pid_item", label: "Item"})
                ]
        });
    };


    var map = function(context) {
        // build payable object and write to context
        var payableObjArr = createPayableObj(JSON.parse(context.value));
        
        log.debug('Length of payableObjArr' + payableObjArr.length);

    };

    exports.getInputData = getInputData;
    exports.map = map;

    return exports;
});
