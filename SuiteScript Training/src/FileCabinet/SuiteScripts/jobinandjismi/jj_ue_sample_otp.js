/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/record', 'N/search', 'N/email'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {email} email
     */
    (log, record, search, email) => {

        /**
         * Function executed after a record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            try {
                const newRecord = scriptContext.newRecord;

                // Check if the event type is CREATE for a Sales Order record
                if (scriptContext.type === scriptContext.UserEventType.CREATE && newRecord.type === record.Type.SALES_ORDER) {
                    const customerId = newRecord.getValue({ fieldId: 'entity' });

                    // Load the customer record to check for overdue balance
                    const customerRecord = record.load({
                        type: record.Type.CUSTOMER,
                        id: customerId
                    });

                    const overdueBalance = customerRecord.getValue({ fieldId: 'overduebalance' });
                    const salesRep = customerRecord.getValue({ fieldId: 'salesrep' });

                    if (overdueBalance > 0) {
                        // Search for the sales manager associated with the sales rep
                        const salesManagerSearch = search.create({
                            type: search.Type.EMPLOYEE,
                            filters: [
                                ['internalid', 'is', salesRep]
                            ],
                            columns: ['supervisor']
                        });

                        const salesManagerSearchResult = salesManagerSearch.run().getRange({ start: 0, end: 1 });

                        if (salesManagerSearchResult.length > 0) {
                            const salesManagerId = salesManagerSearchResult[0].getValue('supervisor');
                            const salesManagerEmail = salesManagerSearchResult[0].getValue({ name: 'email', join: 'supervisor' });

                            if (salesManagerId && salesManagerEmail) {
                                // Prepare email details
                                const subject = 'Sales Order Created for Customer with Overdue Balance';
                                const body = `A new sales order has been created for a customer with an overdue balance.\n\n` +
                                             `Customer ID: ${customerId}\n` +
                                             `Sales Order ID: ${newRecord.id}\n` +
                                             `Overdue Balance: ${overdueBalance}\n`;

                                // Send email to the sales manager
                                email.send({
                                    author: salesRep,
                                    recipients: salesManagerEmail,
                                    subject: subject,
                                    body: body
                                });

                                log.debug('Email Sent', `Overdue balance alert email sent to ${salesManagerEmail}`);
                            }
                        }
                    }
                }
            } catch (e) {
                log.error({
                    title: 'Error Sending Overdue Balance Alert',
                    details: e.toString()
                });
            }
        };

        return {
            afterSubmit: afterSubmit
        };
    });
