/**
 * @NModuleScope Public
 */
define(['../Lib/sweetalert.min.js','N/https', 'N/ui/message'],

function(swal, https, message) {
	
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
    			
    			//TODO Change ID in Production
    			var response = https.request({
    				method: https.Method.GET,
    				url: 'https://forms.na2.netsuite.com/app/site/hosting/scriptlet.nl?script=1787&deploy=1&compid=642845&h=827313aca591c5e03e37&payableId=' + payableId
    			});

    			
    			if(response.body == 'success\n') {
					//TODO The urls are hard coded. Handle these
    				window.open('https://system.na2.netsuite.com/app/common/custom/custrecordentry.nl?rectype=499&id=' + payableId + '&custparam=success', '_self');
    				
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
