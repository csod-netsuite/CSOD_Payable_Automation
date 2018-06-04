/**
 *	07/18/2013 Kalyani Chintala, DSG Case 32613
 *  01/05/2015 Kalyani Chintala, DSG Case 42749 - Added beforeSubmit
 *  09/01/2015 Kalyani Chintala, DSG Case 47749 
 *	09/09/2015 Amod Deshpande,	 DSG Case 47943
 *  09/25/2015 Chetan Jumani, Exlcude the Duplicate Trans ID check for create of vendor bill.
 *  08/02/2017 Chan - Added lines to make Web Services to bypass Approval Workflow 
 */

function vb_BeforeLoad(type, form, request){
	var approvalrole = '';
	var defaultApprovalRole = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_approval_roles');
	var contentApprovalRole = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_approval_role2');
	var billEditRole1 = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_edit_role');
	var billEditRole2 = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_edit_role2');
	var billEditRole3 = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_edit_role3');
	var nextApproverRole = nlapiGetFieldValue('custbody_next_approver_role');
	
	var lockRecord = false;
	
	
	nlapiLogExecution('DEBUG', 'nextApproverRole', nextApproverRole + ', ID: ' + nlapiGetRecordId());
	if(nextApproverRole) {
		if(nextApproverRole == contentApprovalRole) {
			approvalrole = contentApprovalRole
		} else {
			approvalrole = defaultApprovalRole
		}
	} else {
		approvalrole = defaultApprovalRole
	}
	var context = nlapiGetContext();
	var userrole = nlapiGetRole();
	
	if(userrole == defaultApprovalRole || userrole == contentApprovalRole) {
		lockRecord = true;
	}
	if(nextApproverRole == defaultApprovalRole) {
		if(userrole != billEditRole1) {
			lockRecord = true;
		}
	} else if(nextApproverRole == contentApprovalRole) {
		if(userrole != billEditRole2 || userrole != billEditRole3 || userrole != '3') {
			lockRecord = true;
		}
	}
	
	if(type == 'view' && lockRecord){
		
		form.setScript('customscript_vbill_client_side');
		form.removeButton('edit');
		
	}
	if(type == 'edit' && approvalrole == userrole){
		form.setScript('customscript_vbill_client_side');
		form.removeButton('submitbill');
		form.removeButton('submitnew');
		form.removeButton('submitedit');
		form.removeButton('submitsame');
		form.removeButton('submitas');
		form.removeButton('submit');
		form.removeButton('save');
	}

}


function afterSubmit(type)
{
	
	if(type == 'create' || type == 'edit')
	{
		var amt;
		var results = nlapiSearchRecord(nlapiGetRecordType(), null, [new nlobjSearchFilter('mainline', null, 'is', 'T'), new nlobjSearchFilter('internalid', null, 'anyof', nlapiGetRecordId())], new nlobjSearchColumn('amount'));
		if(results != null && results != '')
		{
			var amt = results[0].getValue('amount');
		}
		
		//var currRec = nlapiLoadRecord(nlapiGetRecordType(), nlapiGetRecordId());
		var updUSDTtotalFlag = false;
		if(type == 'create') {
            //updUSDTtotalFlag = true;
           
            if(nlapiGetFieldValue('custbody_created_by_payables_scrpt') == 'T') {
        		nlapiLogExecution('DEBUG', 'Entering FX Rate logic');
             
        		
        		var vendBillRec = nlapiLoadRecord('vendorbill', nlapiGetRecordId());
        		var vendorId = nlapiGetFieldValue('entity');
        		
        		var lineCount = nlapiGetLineItemCount('item');
        		var exchangeRate = +nlapiGetFieldValue('exchangerate');
        		var usePrimaryCurrency = nlapiLookupField('vendor', vendorId, 'custentity_csod_use_primary_curr_payable')
        		var payableCurrency =  nlapiGetFieldValue('currency');
        		var tranDate = nlapiGetFieldValue('trandate');
        		
        		var origSalesOrderId = nlapiGetFieldValue('custbody_sales_order');
    			
				var salesOrderCurrency = nlapiLookupField('salesorder', origSalesOrderId, 'currency');
				
				var newExchangeRate = 0;
				
				newExchangeRate = +nlapiExchangeRate(salesOrderCurrency, payableCurrency, tranDate);
				
				exchangeRate = newExchangeRate;
				
				vendBillRec.setFieldValue('exchangerate', newExchangeRate);
				

	    		var lineUpdated = 0;
	    		
	    		if(usePrimaryCurrency == 'T') {
		
	    			nlapiLogExecution('DEBUG', 'EXCHANGE RATE for use Primary Curr', exchangeRate);
	    			
	    			
	    			for(var line = 1 ; line <= lineCount; line += 1 ) {
	    				vendBillRec.selectLineItem('item', line);
	        			var amount = +vendBillRec.getCurrentLineItemValue('item', 'amount');
	        			var quantity = +vendBillRec.getCurrentLineItemValue('item', 'quantity');
	        			
	        			if(exchangeRate && amount > 0) {
	        				amount = (amount * exchangeRate).toFixed(2); 
	        				var rate = (amount / quantity);
	        				nlapiLogExecution('DEBUG', 'Amount in Line ' + line, amount);
	        				vendBillRec.setCurrentLineItemValue('item', 'amount', amount);
	        				vendBillRec.setCurrentLineItemValue('item', 'rate', rate);
	        				vendBillRec.commitLineItem('item', true);
	        				lineUpdated++;
	        			}
	
	        		}
	    		} 
		    		
	    		if(lineUpdated > 0) {
	    			nlapiSubmitRecord(vendBillRec, false, true);
	    		}
		
    		}
            
        }
        

		else if(type == 'edit' && nlapiGetOldRecord().getFieldValue('usertotal') != nlapiGetNewRecord().getFieldValue('usertotal'))
			updUSDTtotalFlag = true;
		
		// Search for amount column (which is always USD) for this record.
		// Write the amount to "custbody_usd_total" field
		
		if(updUSDTtotalFlag)
		{
			nlapiSubmitField(nlapiGetRecordType(), nlapiGetRecordId(), 'custbody_usd_total', amt);
		}
		
		// Added 8/11/2017
		// Send Email Warning for duplicate tranid (Invoice #)
		if(nlapiGetFieldValue('custbody_created_by_payables_scrpt') != 'T')
		{
			var internalId = nlapiGetRecordId();
			var tranId = nlapiGetFieldValue('tranid');
			var vendor = nlapiGetFieldValue('entity');
			var author = nlapiGetContext().getEnvironment() == 'SANDBOX' ? '92993' : '105102'; // Admin ID hard coded. 
			var recipient = nlapiGetContext().getSetting('SCRIPT', 'custscript_csod_dup_tranid_recipient');
			var baseUrl = nlapiGetContext().getEnvironment() == "SANDBOX" ? 'https://system.sandbox.netsuite.com' : 'https://system.na1.netsuite.com'; 
			var vendorBillLink = baseUrl + nlapiResolveURL('RECORD', 'vendorbill', nlapiGetRecordId());
			var accountId = nlapiGetFieldValue('account');
			
			var ACCOUNT_DUP_NOT_ALLOWED = ['220', '475'];
			
			nlapiLogExecution('Debug', 'Checking', 'tranId - ' + tranId);
			nlapiLogExecution('Debug', 'This Vendor Bill URL', vendorBillLink);
			nlapiLogExecution('Debug', 'This recipient', recipient);
			
			if(tranId && recipient) {
				
				if(ACCOUNT_DUP_NOT_ALLOWED.indexOf(accountId) > -1) {
					
					if(!checkDuplicateNumber(internalId, tranId, vendor, false)) {
						var subject = '[NetSuite Warning] Duplicate Vendor Bill Tran ID was used';
						var body = 'Hello. <br/> ';
						body += 'You are receiving this email because we detected duplicate Invoice Number used in new Vendor Bill<br/>';
						body += 'Click the link below to review the Vendor Bill <br/><br/>';
						body += '<a href="' + vendorBillLink + '">Click to review Vendor Bill</a>';
						
						nlapiSendEmail(author, recipient, subject, body);
					}
				}
				
			}
			
		}
		
		// Bryce/Chan 11/2 Adding Field Validator for Resend for Re-approval 
		if(type == 'edit')  {
			
			var executionContext = nlapiGetContext().getExecutionContext();
			
			if(executionContext == 'userinterface' || executionContext == 'scheduled') {
				var newRec = nlapiGetNewRecord();
				var oldRec = nlapiGetOldRecord();
				var triggerWorkflow = false;
				
				var isConcur = newRec.getFieldValue('custbody_created_in_concur');
				var isAmountOver5000 = +amt >= 5000 ? true : false;
				
				if(isConcur != 'T' && isAmountOver5000) {
					var oldAcct = oldRec.getFieldValue('account');
					var newAcct = newRec.getFieldValue('account');
					
					if(oldAcct != newAcct) {
						triggerWorkflow = true;
					}
					
					var oldTrandate = oldRec.getFieldValue('trandate');
					var newTrandate = newRec.getFieldValue('trandate');
					
					if(oldTrandate != newTrandate) {
						triggerWorkflow = true;
					}
					
					var oldDept = oldRec.getFieldValue('department');
					var newDept = newRec.getFieldValue('department');
					
					if(oldDept != newDept) {
						triggerWorkflow = true;
					}
					
					var oldCurrency = oldRec.getFieldValue('currency');
					var newCurrency = newRec.getFieldValue('currency');
					
					if(oldCurrency != newCurrency) {
						triggerWorkflow = true;
					}
					
					var isSublistChanged = getOldNewSublist(newRec, oldRec);
					
					if(isSublistChanged) {
						triggerWorkflow = true;
					}
					
					var oldUSDTotal = oldRec.getFieldValue('custbody_usd_total');
					var newUSDTotal = newRec.getFieldValue('custbody_usd_total');
					
					nlapiLogExecution('DEBUG', 'Old and New USD Total', 'Old: ' + oldUSDTotal + ', New: ' + newUSDTotal);
					
					if(!newUSDTotal || !oldUSDTotal) {
						nlapiLogExecution('ERROR', 'USD Total is Empty', 'USD Total is Empty ' + nlapiGetRecordId());
					} 
					
					if(oldUSDTotal != newUSDTotal) {
						triggerWorkflow = true;
					}
					
				}
				
				
				// Put the record into Workflow Resent for Re-approval
				if(triggerWorkflow) {
					var workflowId = nlapiTriggerWorkflow(nlapiGetRecordType(), 
							nlapiGetRecordId(), 27, 'workflowaction87961', 'workflowstate56');
					
					nlapiLogExecution('DEBUG', 'Workflow Triggered', workflowId);
				}
				
				
			}
			
		}
		
	}
	

}

function beforeSubmit(type)
{
	if(type == 'create' || type == 'edit')
	{
		var throwError = false;
		nlapiLogExecution('Debug', 'Execution Check', nlapiGetContext().getExecutionContext());
		//nlapiLogExecution('Debug', 'Execution Check', nlapiGetContext().getRoleId());
		
		// webservices (Concur) bypasses approval workflow
		if(nlapiGetContext().getExecutionContext() == 'webservices') {
			
			var accountId = nlapiGetFieldValue('account');
			
			if(accountId != '475'){
				nlapiSetFieldValue('approvalstatus', '2');
				nlapiSetFieldValue('custbody_created_in_concur', 'T');
			}
			
		}
		
		// DSG Case 47943 start
		var vendor = nlapiGetFieldValue('entity');

		var createdFromSO = nlapiGetFieldValue('custbody_sales_order');
		if (createdFromSO != null && createdFromSO != '')
		{	
			nlapiSetFieldValue('memo', nlapiGetLineItemValue('item','description',1)); // there is going to be only 1 item for such Bills
			
			// get and set AP account from Vendor record
			if (vendor != null && vendor != '')
			{	
				
				var apAccount = nlapiLookupField('vendor', vendor, 'payablesaccount'); 
				if (apAccount != null && apAccount != '')	
					nlapiSetFieldValue('account', apAccount);
			}	
		}
		var expenseApprovalRole = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_approval_roles'); 
		var billApprovalRole = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_approval_role2');
		var billEditRole1 = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_edit_role');
		var billEditRole2 = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_edit_role2');
		var billEditRole3 = nlapiGetContext().getSetting('SCRIPT', 'custscript_vb_edit_role3');
		
		var nextApprovalRole = '';
		nlapiLogExecution('DEBUG', 'approvalrole', expenseApprovalRole);
      	//var recipient = nlapiGetContext().getSetting('SCRIPT', 'custscript_csod_dup_tranid_recipient'); BC Used for reference - can delete
      	//var approvalrole = '1014'; // BC used to get past parameter
      
      	if(!expenseApprovalRole){
          return nlapiCreateError('E1001','Please enter a Vendor Bill Approval Role on the cso_SS_vendorBill deployment');
        }
      	
      	/**
      	 * CSOD Change Log 3/6/2018 
      	 * Approval Roles are diverging depending on Bill Types (Content Bill vs Everything Else)
      	 */
      	var createdByScript = nlapiGetFieldValue('custbody_created_by_payables_scrpt');
      	if(createdByScript) {
      		nextApprovalRole = billApprovalRole;
      	} else{
      		if(nlapiLookupField('vendor', vendor, 'custentity_content_provider') == 'T') {
      			nextApprovalRole = billApprovalRole;
      		} else {
      			nextApprovalRole = expenseApprovalRole;
      		}
      	}
      	
      	nlapiSetFieldValue('custbody_next_approver_role', nextApprovalRole);
      	
      	var userrole = nlapiGetRole();
      	var status = nlapiGetFieldValue('approvalstatus');
      	nlapiLogExecution('DEBUG', 'User Role', userrole);
      	nlapiLogExecution('DEBUG', 'Status', status);
      	
      	if(expenseApprovalRole == userrole || billApprovalRole == userrole && status != '2') {
      		throwError = true
      	}
      	
      	// if AP Manager is next approver
      	if(nextApprovalRole == expenseApprovalRole && status != '2') {
      		// if user is not billEditRole1
      		if(userrole != billEditRole1) {
      			throwError = true;
      		}
      	}
      	
      	// if Sr. GL Accountant is next approver 
      	if(nextApprovalRole == billApprovalRole && status != '2') {
      		if(userrole != billEditRole2 || userrole != billEditRole3) {
      			throwError = true;
      		}
      	}
      	
      	if(throwError && nlapiGetContext().getExecutionContext() === 'userinterface' && userrole != '3') {
      		nlapiLogExecution('ERROR', 'Permission Violation', 'Role = ' + userrole);
      		var er = nlapiCreateError('E1100', 'This role does not have the ability to edit or create Vendor Bills');
      		throw er;
        }
      	

// DSG Case 47943 end	

		nlapiLogExecution('Debug', 'Checking', 'Create Paybles - ' + nlapiGetFieldValue('custbody_created_by_payables_scrpt'));
		
		// Start 09/25/2015 Chetan Jumani cjumani@netsuite.com
		if (type != 'edit')
		{
			nlapiLogExecution('DEBUG', 'Vendor Bill - Server Side:beforeSubmit', 'Exiting Because Execution Context :'+type );
			return;
		}
		// End 09/25/2015 Chetan Jumani cjumani@netsuite.com
		
		// @Description: If the record is not created by script and is being edited, check duplicate 
		
		
		/* Case 47749: START */ 
		// Approval Logic 
		
		
		var acctList = convNull(nlapiGetContext().getSetting('SCRIPT', 'custscript_bill_accts_need_approval'));
		if(acctList != '')
		{
			var isApprNeededSet = false;
			for(var line=1; line <= nlapiGetLineItemCount('expense'); line++)
			{
				var acct = convNull(nlapiGetLineItemValue('expense', 'account', line));
				if(acct == '')
					continue;
				if(acctList.indexOf('|' + acct + '|') > -1)
				{
					nlapiSetFieldValue('custbody_require_approval', 'T');
					break;
				}
			}
			
			if(!isApprNeededSet)
			{
				for(var line=1; line <= nlapiGetLineItemCount('item'); line++)
				{
					var acct = convNull(nlapiGetLineItemValue('item', 'custcol_ava_expenseaccount', line));
					if(acct == '')
						continue;
					if(acctList.indexOf('|' + acct + '|') > -1)
					{
						nlapiSetFieldValue('custbody_require_approval', 'T');
						break;
					}
				}
			}
		}
	
	
		/* Case 47749: END */
	}
}

function convNull(value)
{
	if(value == null)
		value = '';
	return value;
}

function getOldNewSublist(newRec, oldRec) {
	var newRecSublistCount = newRec.getLineItemCount('item');
	var oldRecSublistCount = oldRec.getLineItemCount('item');
	
	isChanged = false;
	
	if(newRecSublistCount != oldRecSublistCount) {
		// return true no further validation needed
		return true;
	}
	
	for(var linenum = 1; linenum <= newRecSublistCount; linenum++) {
		
		if(isChanged) {
			break;
		}
		
		var newLineItem = newRec.getLineItemValue('item', 'item', linenum);
		var oldLineItem = newRec.getLineItemValue('item', 'item', linenum);
		
		if(newLineItem != oldLineItem) {
			// return true no further validation needed
			isChanged = true;
			
		}
		
		var newAmortSched = newRec.getLineItemValue('item', 'amortizationsched', linenum);
		var oldAmortSched = oldRec.getLineItemValue('item', 'amortizationsched', linenum);
		
		if(newAmortSched != oldAmortSched) {
			isChanged = true;
			
		}
		
		var newStartDate = newRec.getLineItemValue('item', 'amortizstartdate', linenum);
		var oldStartDate = oldRec.getLineItemValue('item', 'amortizstartdate', linenum);
		
		if(oldStartDate != newStartDate) {
			isChanged = true;
		}
		
		var newEndDate = newRec.getLineItemValue('item', 'amortizationenddate', linenum);
		var oldEndDate = oldRec.getLineItemValue('item', 'amortizationenddate', linenum);
		
		if(newEndDate != oldEndDate) {
			isChanged = true;
		}
		
	}
	
	return isChanged;
	
} 