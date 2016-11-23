# azbeesLong story short, I was looking for a "bees with machine guns" clone that was working on Microsoft Azure. After hours serching and browsing : no love. I therefore decides to create myself a very minimaost Azure compatible version of it.## Installation1. If you don't already have it, [get node.js](https://nodejs.org).2. Clone the repo```git clone https://github.com/pierreg256/azbees.git```3. then install all the dependencies```cd azbeesnpm install```And you're good to go!## Configurationazbees uses your Azure credentials to connect and deploy ressources on the Azure cloud. To get your credentials, please create a principal using the Azure portal and fetch te following information:* Subscription ID* Client ID* Client Password* Tenant IDCreate an Azure service principal either through    [Azure CLI](https://azure.microsoft.com/documentation/articles/resource-group-authenticate-service-principal-cli/),    [PowerShell](https://azure.microsoft.com/documentation/articles/resource-group-authenticate-service-principal/)    or [the portal](https://azure.microsoft.com/documentation/articles/resource-group-create-service-principal-portal/).configure your azbees connection with the following command:```$ azbees config -b SUBSCRIPTION_ID -c CLIENT_ID -s CLIENT_SECRET -t TENANT> Successfully stored config in the following file: azbees.config ```alternatively you can provide a `JSON` config file named `azbees.config` and with  the following format : ```javascript{  "clientId": "d945278b-42e1-4e80-a651-sampleclientid",  "clientSecret": "YsKN2VmDP3secretsecretsecret/yvtZw=",  "tenant": "72f988bf-86f1-41af-91ab-sampletenant",  "subscriptionId": "d9df0a1a-1c52-47f2-a715-samplesubscriptionid"}```## Spinning up the swarm to load your systemOnce the config is Ok and store in the JSON file, your can spin up the bees with the `bees up` command:```azbees up -i 2 -a scripts\loaderarchive.zip -x relative\path\to\executable.exe```This command will spin up two bees (Azure VMs) where the archive will be sent and unzipped. The bee will then run the executable from the archive. You should see the following output :```Creating resource group: azbees_rgCreating resources storage group... please be patient...Uploading executable file...Uploading startup script...Spinning 2 bees in the swarm... please be patient...Bees spun up successfully!```