function fileLoaded(event){
    $.each(document.getElementById("uploadFile").files, function (key, f) {
        const types = {
            'application/msword': 'DOC',
            'application/pdf': 'PDF',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
        }
        if (!types[f.type]) {
            return;
        }
        $('#secondTable').append('<tr><td>'+f.name+'</td><td>'+types[f.type]+'</td></tr>');
    })
}

const CADESCOM_CADES_BES = 1;
const CAPICOM_CURRENT_USER_STORE = 2;
const CAPICOM_MY_STORE = "My";
const CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2;
const CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME = 1;
const CADESCOM_BASE64_TO_BINARY = 1;

function Verify(sSignedMessage) {
    let oSignedData = cadesplugin.CreateObject("CAdESCOM.CadesSignedData");
    try {
        oSignedData.VerifyCades(sSignedMessage, CADESCOM_CADES_X_LONG_TYPE_1);
    } catch (err) {
        alert("Failed to verify signature. Error: " + cadesplugin.getLastError(err));
        return false;
    }

    return true;
}

function run() {
    let oCertName = document.getElementById("CertName");
    let sCertName = oCertName.value; // Здесь следует заполнить SubjectName сертификата
    if ("" === sCertName) {
        alert("Введите имя сертификата (CN).");
        return;
    }
    let signedMessage = SignCreate(sCertName, "Message");

    document.getElementById("signature").innerHTML = signedMessage;

    let verifyResult = Verify(signedMessage);
    if (verifyResult) {
        alert("Signature verified");
    }
}

function getVersion() {
    cadesplugin.async_spawn(function* (args) {
        var ProviderName = "Crypto-Pro GOST R 34.10-2012 Cryptographic Service Provider";
        var ProviderType = 80;
        try
        {
            var oAbout = yield cadesplugin.CreateObjectAsync("CAdESCOM.About");
            oVersion = yield oAbout.CSPVersion(ProviderName, parseInt(ProviderType, 10));

            var Minor = yield oVersion.MinorVersion;
            var Major = yield oVersion.MajorVersion;
            var Build = yield oVersion.BuildVersion;
            var Version = yield oVersion.toString();
            console.log(oVersion)
        }
        catch (er)
        {
            err = cadesplugin.getLastError(er);
            if (err.indexOf("0x80090019") + 1)
                return "Указанный CSP не установлен";
            else
                return err;
        }
    });
}

function PrintLicense() {
    return new Promise(function (resolve, reject) {
        cadesplugin.async_spawn(function* (args) {
            try {
                //let oStore = yield cadesplugin.CreateObject("CAdESCOM.Store");
                let oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                yield oStore.Open();

                let certs = yield oStore.Certificates;
                let certsCount = yield certs.Count;

                let rows = []
                for (let i = 1; i <= certsCount; i++) {
                    let cert = yield certs.Item(i);

                    let validToDate = new Date((yield cert.ValidToDate));
                    
                    $('#firstTable').append('<tr style="background: #FFB1B1">\n' +
                        '                        <td>'+(yield cert.SubjectName)+'</td>\n' +
                        '                        <td>'+(yield cert.ValidFromDate)+'</td>\n' +
                        '                        <td>'+(yield cert.ValidToDate)+'</td>\n' +
                        '                    </tr>');

                    rows.push({
                        'SubjectName': yield cert.SubjectName,
                        'ValidFromDate': yield cert.ValidFromDate,
                        'ValidToDate': yield cert.ValidToDate,
                        'IssuerName': yield cert.IssuerName,
                        'SerialNumber': yield cert.SerialNumber,
                        // 'PrivateKey': yield cert.PrivateKey,
                        // 'Version': yield cert.Version,
                        // 'Thumbprint': yield cert.Thumbprint,
                    })
                }
                console.table(rows)

                yield oStore.Close();
            }
            catch (err) {
                alert(cadesplugin.getLastError(err));
            }
        }, resolve, reject);
    });
}

function signFile(oFile, certificateIndex, fKey) {
    let oFReader = new FileReader()
    oFReader.readAsDataURL(oFile)
    oFReader.onload = function (oFREvent) {
        console.log('oFReader.onload')
        cadesplugin.async_spawn(function* (args) {
            const header = ";base64,";
            let sFileData = oFREvent.target.result;
            let sBase64Data = sFileData.substr(sFileData.indexOf(header) + header.length);
            //console.log(window.atob(sBase64Data))

            let oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store")
            yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE, CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED)

            //let certIdent = document.getElementById("certIdent").value

            let oCertificates = yield oStore.Certificates;

            let oCertificate = yield oCertificates.Item(certificateIndex);
            let oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
            yield oSigner.propset_Certificate(oCertificate);
            yield oSigner.propset_CheckCertificate(true);

            let oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
            yield oSignedData.propset_ContentEncoding(CADESCOM_BASE64_TO_BINARY);
            yield oSignedData.propset_Content(sBase64Data);

            let sSignedMessage = 'sisisis'
            //let sSignedMessage = yield oSignedData.SignCades(oSigner, CADESCOM_CADES_BES, true);

            //console.log(sSignedMessage)

            localStorageSetFile(fKey, sSignedMessage, oFile.name, oFile.type)

            yield oStore.Close();
        })
    }
}

function localStorageSetFile(fKey, sMess, fName, fType) {
    let files = JSON.parse(localStorage.getItem('files'))
    files.push({
        file_index: fKey,
        sign: sMess,
        file_name: fName,
        file_type: fType,
    })
    localStorage.setItem('files', JSON.stringify(files));
}

function signFiles() {
    localStorage.setItem('files', JSON.stringify([]))
    $.each(document.getElementById("uploadFile").files, function (key, f) {
        const types = {
            'application/msword': 'DOC',
            'application/pdf': 'PDF',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
        }
        if (!types[f.type]) {
            return
        }
        let certificateIndex = 1
        if (types[f.type] === 'PDF') {
            signFile(f, certificateIndex, key)
        } else {
            signFile(f, certificateIndex, key)
        }
    });
}

cadesplugin.then(function () {
        //console.log('OK!')
        PrintLicense()
    },
    function(error) {
        console.log('error', error)
    }
);
