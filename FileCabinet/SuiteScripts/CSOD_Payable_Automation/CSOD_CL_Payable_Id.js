/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/https', 'N/ui/message','../Lib/sweetalert.min'],

function(https, message, swal) {
	
	function showMessage() {
		var myMsg = message.create({
            title: "Success",
            message: 'All bills are deleted.',
            type: message.Type.CONFIRMATION
        }).show({
            duration: 10000
        });
	}
	
    
    function deleteAllBills(payableId) {
    	swal("Are you sure you want to delete the bills?", {
    		buttons: {
    			 cancel: "No, I changed my mind.",
    			 Yes: {
    				 text: "Yes!",
    				 value: "confirm"
    			 }
    		}
    	})
    	.then(function(value) {
    		if(value == 'confirm') {
    			
    			swal("Deleting Bills...", {
        			icon: "info",
        			button: false
        		});
    			
    			
    			var response = https.request({
    				method: https.Method.GET,
    				url: 'https://forms.netsuite.com/app/site/hosting/scriptlet.nl?script=1101&deploy=1&compid=642845_SB2&h=fb58ae3b10acb00e9ec2&payableId=' + payableId
    			});

    			
    			if(response.body == 'success\n') {
    				
    				window.open('https://system.netsuite.com/app/common/custom/custrecordentry.nl?rectype=491&id=' + payableId + '&custparam=success', '_self');
    				
    			} else {
    				swal("There was an error.", "Please contact administrator","error");
    			
    			}
    			
    		}
    	});
    }
    return {
    	showMessage: showMessage,
        deleteAllBills: deleteAllBills
    };
    
});
