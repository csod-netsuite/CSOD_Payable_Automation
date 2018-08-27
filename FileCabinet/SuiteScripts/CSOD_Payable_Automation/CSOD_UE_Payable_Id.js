/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget'],
/**
 * @param {record} record
 * @param {redirect} redirect
 */
function(ui) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(scriptContext) {
    	
    	if(scriptContext.type !== scriptContext.UserEventType.VIEW) return;
    	
    	var requestMessage = scriptContext.request.parameters.custparam;
    	var payableCreated = scriptContext.newRecord.getValue('custrecord_pid_all_bills_created');
    	
    	var form = scriptContext.form;
    	
    	form.clientScriptFileId = 'SuiteScripts/CSOD_Payable_Automation/CSOD_CL_Payable_Id';
    	
    	log.debug("custparam check", requestMessage);
    	
    	if(requestMessage == 'success') {
    		//client.showAlert();
    		
    		// !DEVELOPER NOTE : N/ui/message isn't supported in beforeLoad user event script. The code below is exploit code.
    		// TODO: Change this code once Enhancement 387483 is released
        	var inline = form.addField({
                id:'custpage_trigger_it',
                label:'not shown',
                type: ui.FieldType.INLINEHTML,
            });
        	inline.defaultValue = "<script type='text/javascript'>jQuery(function($){ require(['SuiteScripts/CSOD_Payable_Automation/CSOD_CL_Payable_Id'], function(mod){ console.log('loaded'); mod.showMessage();" +
        			"});" +
        			"});" +
        			"</script>";
    	}
    	
		if(payableCreated) {

        	form.addButton({
        		id: 'custpage_delete_bills_btn',
        		label: 'Delete All Bills',
        		functionName: 'deleteAllBills(' + scriptContext.newRecord.id + ')'
        	});
    	}

    }


    return {
        beforeLoad: beforeLoad
    };
    
});
